import { useState, useEffect, useRef, useCallback } from 'react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { isNative } from './useCapacitor'

/**
 * Hook for pull-to-refresh gesture
 * @param {Function} onRefresh - Async callback to execute on refresh
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Distance to pull before triggering (default: 80)
 * @param {number} options.resistance - Pull resistance factor (default: 2.5)
 * @param {boolean} options.enabled - Enable/disable pull to refresh (default: true)
 */
export function usePullToRefresh(onRefresh, options = {}) {
  const {
    threshold = 80,
    resistance = 2.5,
    enabled = true
  } = options

  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [canPull, setCanPull] = useState(false)

  const touchStartRef = useRef({ y: 0, scrollTop: 0 })
  const containerRef = useRef(null)
  const hapticTriggeredRef = useRef(false)

  const triggerHaptic = useCallback(async (style = ImpactStyle.Light) => {
    if (isNative()) {
      try {
        await Haptics.impact({ style })
      } catch (error) {
        // Haptics not available
      }
    }
  }, [])

  const handleTouchStart = useCallback((e) => {
    if (!enabled || isRefreshing) return

    const touch = e.touches[0]
    const scrollTop = containerRef.current?.scrollTop || window.scrollY

    touchStartRef.current = {
      y: touch.clientY,
      scrollTop
    }

    // Only allow pull if scrolled to top
    setCanPull(scrollTop === 0)
    hapticTriggeredRef.current = false
  }, [enabled, isRefreshing])

  const handleTouchMove = useCallback((e) => {
    if (!enabled || isRefreshing || !canPull) return

    const touch = e.touches[0]
    const deltaY = touch.clientY - touchStartRef.current.y

    // Only pull down, not up
    if (deltaY > 0) {
      // Apply resistance
      const distance = deltaY / resistance
      setPullDistance(Math.min(distance, threshold * 1.5))

      // Trigger haptic when crossing threshold
      if (distance >= threshold && !hapticTriggeredRef.current) {
        triggerHaptic(ImpactStyle.Medium)
        hapticTriggeredRef.current = true
      }

      // Prevent default scrolling when pulling
      if (distance > 10) {
        e.preventDefault()
      }
    }
  }, [enabled, isRefreshing, canPull, resistance, threshold, triggerHaptic])

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || isRefreshing || !canPull) {
      setPullDistance(0)
      return
    }

    const shouldRefresh = pullDistance * resistance >= threshold

    if (shouldRefresh) {
      setIsRefreshing(true)
      triggerHaptic(ImpactStyle.Heavy)
      
      try {
        await onRefresh()
      } catch (error) {
        console.error('Refresh failed:', error)
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }

    setCanPull(false)
  }, [enabled, isRefreshing, canPull, pullDistance, resistance, threshold, onRefresh, triggerHaptic])

  const progress = Math.min((pullDistance * resistance) / threshold, 1)

  return {
    pullToRefreshHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    },
    pullDistance,
    isRefreshing,
    progress,
    containerRef
  }
}
