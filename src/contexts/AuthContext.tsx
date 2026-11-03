import { createContext, useContext, useEffect, useState } from 'react'

// Mock user type (simplified version of Supabase User)
interface MockUser {
  id: string
  email: string
  created_at: string
}

interface AuthContextType {
  user: MockUser | null
  session: { user: MockUser } | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Mock auth - stores in localStorage for persistence
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null)
  const [session, setSession] = useState<{ user: MockUser } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session in localStorage
    const storedUser = localStorage.getItem('mock_user')
    if (storedUser) {
      const mockUser = JSON.parse(storedUser)
      setUser(mockUser)
      setSession({ user: mockUser })
    }
    setLoading(false)
  }, [])

  const signIn = async (email: string, password: string) => {
    // Mock sign in - just needs valid email format
    if (!email.includes('@')) {
      throw new Error('Invalid email format')
    }
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const mockUser: MockUser = {
      id: 'mock-user-' + Date.now(),
      email,
      created_at: new Date().toISOString()
    }
    
    localStorage.setItem('mock_user', JSON.stringify(mockUser))
    setUser(mockUser)
    setSession({ user: mockUser })
  }

  const signUp = async (email: string, password: string) => {
    // Mock sign up - same as sign in for now
    if (!email.includes('@')) {
      throw new Error('Invalid email format')
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const mockUser: MockUser = {
      id: 'mock-user-' + Date.now(),
      email,
      created_at: new Date().toISOString()
    }
    
    localStorage.setItem('mock_user', JSON.stringify(mockUser))
    setUser(mockUser)
    setSession({ user: mockUser })
  }

  const signOut = async () => {
    localStorage.removeItem('mock_user')
    setUser(null)
    setSession(null)
  }

  const signInWithMagicLink = async (email: string) => {
    // Mock magic link - just sign in immediately
    if (!email.includes('@')) {
      throw new Error('Invalid email format')
    }
    
    // Simulate sending magic link
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // In real app, user would click link in email
    // For demo, we just sign them in
    throw new Error('Magic link sent! (Mock: would normally require email verification)')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        signInWithMagicLink,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        signInWithMagicLink,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
