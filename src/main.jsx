import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AccessibilityProvider } from './context/AccessibilityContext'

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AccessibilityProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AccessibilityProvider>
    </React.StrictMode>
  )
} catch (err) {
  document.body.innerHTML = `<pre style="color:red;">${err.stack}</pre>`;
}
