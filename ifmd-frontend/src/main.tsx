import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './AuthAccount.tsx'
import CreateAccount from './CreateAccount.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <CreateAccount />
  </StrictMode>,
)