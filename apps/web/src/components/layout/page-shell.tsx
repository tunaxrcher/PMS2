import React from 'react'

interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={`space-y-6 ${className || ''}`}>
      {children}
    </div>
  )
}
