import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (err) {
  document.body.innerHTML = `<pre style="color:red;">${err.stack}</pre>`;
}
