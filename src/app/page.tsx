import { redirect } from 'next/navigation'

/** The app is the chat. Proxy sends signed-out visitors to /login from here. */
export default function Home() {
  redirect('/chat')
}
