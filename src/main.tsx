import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyUiScale, storedUiScale } from './uiScale'

// The interface scale override has to be on the root element before the first
// paint, otherwise a stored 200 % would flash at the automatic size first.
applyUiScale(storedUiScale())

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
