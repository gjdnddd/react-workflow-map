import { Component } from 'react'

export default class MapErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <pre style={{ color: 'red', padding: 16, whiteSpace: 'pre-wrap' }}>
          {this.state.error.message}
          {'\n'}
          {this.state.error.stack}
        </pre>
      )
    }
    return this.props.children
  }
}
