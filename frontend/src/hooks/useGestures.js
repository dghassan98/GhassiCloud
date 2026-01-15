import { useEffect, useRef, useCallback } from 'react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { isNative } from './useCapacitor'

/**
 * Custom hook for handling touch gestures
 * @param {Object} options - Configuration options
 * @param {Function} options.onLongPress - Callback for long press
 * @param {Function} options.onSwipeRight - Callback for swipe right
 * @param {Function} options.onSwipeLeft - Callback for swipe left
 * @param {number} options.longPressDuration - Duration in ms for long press (default: 500)
 * @param {number} options.swipeThreshold - Minimum distance in px for swipe (default: 80)
 * @param {boolean} options.enableHaptics - Enable haptic feedback (default: true)
 */
export function useGestures(options = {}) {
  const {
    onLongPress,
    onSwipeRight,
    onSwipeLeft,
    longPressDuration = 500,
    swipeThreshold = 80,
    enableHaptics = true
  } = options

  const touchStartRef = useRef({ x: 0, y: 0, time: 0 })
  const longPressTimerRef = useRef(null)
  const isLongPressRef = useRef(false)

  const triggerHaptic = useCallback(async (style = ImpactStyle.Light) => {
    // `isNative` is a boolean exported from useCapacitor — do not call as a function
    if (enableHaptics && isNative) {
      try {
        // Guard against Haptics API not being available on some platforms
        if (Haptics && typeof Haptics.impact === 'function') {
          await Haptics.impact({ style })
        }
      } catch (error) {
        // Haptics not available
      }
    }
  }, [enableHaptics])

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    }
    isLongPressRef.current = false

    // Start long press timer
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true
        triggerHaptic(ImpactStyle.Medium)
        onLongPress()
      }, longPressDuration)
    }
  }, [onLongPress, longPressDuration, triggerHaptic])

  const handleTouchMove = useCallback((e) => {
    // If user moves finger, cancel long press
    const touch = e.touches[0]
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x)
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y)

    if (deltaX > 10 || deltaY > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }
  }, [])

  const handleTouchEnd = useCallback((e) => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    // If it was a long press, don't process swipe
    if (isLongPressRef.current) {
      isLongPressRef.current = false
      return
    }

    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y
    const deltaTime = Date.now() - touchStartRef.current.time

    // Ensure it's more horizontal than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && deltaTime < 500) {
      // Swipe right
      if (deltaX > swipeThreshold && onSwipeRight) {
        triggerHaptic(ImpactStyle.Light)
        onSwipeRight()
      }
      // Swipe left
      else if (deltaX < -swipeThreshold && onSwipeLeft) {
        triggerHaptic(ImpactStyle.Light)
        onSwipeLeft()
      }
    }
  }, [onSwipeRight, onSwipeLeft, swipeThreshold, triggerHaptic])

  return {
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    },
    triggerHaptic
  }
}

/**
 * Hook for long press gesture only
 */
export function useLongPress(callback, duration = 500) {
  const { touchHandlers } = useGestures({
    onLongPress: callback,
    longPressDuration: duration
  })
  return touchHandlers
}

/**
 * Hook for swipe gestures only
 */
export function useSwipe({ onLeft, onRight, threshold = 80 } = {}) {
  const { touchHandlers } = useGestures({
    onSwipeLeft: onLeft || (() => {}),
    onSwipeRight: onRight || (() => {}),
    swipeThreshold: threshold
  })
  return touchHandlers
}
