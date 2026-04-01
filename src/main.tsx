import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'

import { createQueryClient } from '@/lib/query-client'

import App from '@/App'
import './index.css'

const queryClient = createQueryClient()

document.documentElement.classList.add('dark')

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
)
