import React from 'react'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

function NavBar() {
  return (
    <nav className='fixed top-2 left-1/2 -translate-x-1/2 w-1/2 max-w-2xl bg-white z-99 rounded-full flex items-center justify-between p-2 shadow-lg'>
        <div >
            <img src="/logo.svg" alt="Logo" className='size-6' />
        </div>
        <div >
            <Link className={cn(buttonVariants({ variant: "default" }), "px-6")} href="/sign-up">
                <span className='font-righteous capitalize'>get started</span>
            </Link>
        </div>
    </nav>
  )
}

export default NavBar