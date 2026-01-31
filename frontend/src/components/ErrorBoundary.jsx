import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    logger.error('ErrorBoundary caught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h3>Something went wrong</h3>
          <p>We're sorry — an unexpected error occurred in this section.</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>Dismiss</button>
        </div>
      )
    }

    return this.props.children
  }
}
