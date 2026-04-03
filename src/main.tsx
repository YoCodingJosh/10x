import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'

import { createQueryClient } from '@/lib/query-client'
import { initAgentNotificationBridge } from '@/stores/agent-notification-store'

import App from '@/App'
import 'sonner/dist/styles.css'
import './index.css'

initAgentNotificationBridge()

const queryClient = createQueryClient()

document.documentElement.classList.add('dark')

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <Toaster theme="dark" position="bottom-right" richColors closeButton />
  </QueryClientProvider>,
)
