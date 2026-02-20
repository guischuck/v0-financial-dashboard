import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
            <SignIn
                signUpUrl="/register"
                fallbackRedirectUrl="/dashboard"
            />
        </div>
    )
}
