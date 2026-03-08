import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function LoginSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Skeleton className="mx-auto h-14 w-14 rounded-full" />
          <Skeleton className="mx-auto mt-4 h-7 w-48" />
          <Skeleton className="mx-auto mt-2 h-5 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
