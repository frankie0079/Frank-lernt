"use client";

import { useAuth } from "@/components/auth-provider";
import { AvatarUpload } from "@/components/avatar-upload";
import { DisplayNameForm } from "@/components/display-name-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="mx-auto h-24 w-24 rounded-full" />
            <Skeleton className="mx-auto mt-4 h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return null; // Middleware redirects to /login
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        {/* Back navigation */}
        <Link
          href="/events"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Zurueck zu Meine Events"
        >
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          Meine Events
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Mein Profil</CardTitle>
            <CardDescription>
              {user.email}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Avatar Upload */}
            <AvatarUpload
              userId={user.id}
              currentAvatarUrl={profile?.avatar_url ?? null}
              displayName={profile?.display_name ?? null}
              onUploadComplete={() => refreshProfile()}
            />

            <Separator />

            {/* Display Name Form */}
            <DisplayNameForm
              userId={user.id}
              currentName={profile?.display_name ?? null}
              onSaveComplete={() => refreshProfile()}
            />

            <Separator />

            {/* Sign Out */}
            <Button
              variant="outline"
              className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Abmelden
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
