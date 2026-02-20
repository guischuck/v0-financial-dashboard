import { SignUp } from '@clerk/nextjs'

export default function RegisterPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
            <SignUp
                signInUrl="/login"
                fallbackRedirectUrl="/onboarding"
            />
        </div>
    )
}
