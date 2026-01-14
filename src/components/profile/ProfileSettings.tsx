"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/types/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  user: SessionUser;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    bio: string | null;
    is_public_profile: boolean;
  } | null;
};

export function ProfileSettings({ user, profile }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [isPublic, setIsPublic] = useState(profile?.is_public_profile || false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);
    setProfileLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      
      // Check if username is taken (if changed)
      if (username !== profile?.username) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username)
          .maybeSingle();
        
        if (existing) {
          setProfileError("Username is already taken.");
          setProfileLoading(false);
          return;
        }
      }

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          username,
          display_name: displayName || null,
          bio: bio || null,
          is_public_profile: isPublic
        });

      if (error) {
        setProfileError(error.message);
      } else {
        setProfileSuccess(true);
        // Refresh the page to show updated profile
        setTimeout(() => {
          router.refresh();
        }, 1000);
      }
    } catch (err) {
      setProfileError("Something went wrong. Please try again.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    setPasswordLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      
      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword
      });

      if (signInError) {
        setPasswordError("Current password is incorrect.");
        setPasswordLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        setPasswordError(updateError.message);
      } else {
        setPasswordSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your Profile</h1>
          <p className="mt-1 text-xs text-slate-400">
            Manage your account settings and preferences
          </p>
        </div>
        <Link
          href="/app"
          className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 hover:border-dream-400 hover:text-dream-300"
        >
          Back to atlas
        </Link>
      </header>

      {/* Profile Settings */}
      <section className="rounded-3xl border border-slate-800 bg-night-800/70 p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Profile Information</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="displayName" className="text-xs font-medium text-slate-300">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="username" className="text-xs font-medium text-slate-300">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              pattern="[a-z0-9_-]+"
              className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              placeholder="username"
            />
            <p className="text-xs text-slate-500">
              Your public profile will be at /u/{username || "username"}
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="bio" className="text-xs font-medium text-slate-300">
              Bio
            </label>
            <textarea
              id="bio"
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="isPublic"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-700 bg-night-900 text-dream-500 focus:ring-dream-500"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <label htmlFor="isPublic" className="text-xs font-medium text-slate-300">
                Make my profile public
              </label>
            </div>
            <p className="text-xs text-slate-500 pl-6">
              When public, your profile will be accessible at <code className="text-dream-300">/u/{username || "username"}</code>. 
              Only dreams marked as &quot;public&quot; will appear on your public profile.
            </p>
          </div>

          {profileError && (
            <p className="text-xs text-rose-400" role="alert">
              {profileError}
            </p>
          )}
          {profileSuccess && (
            <p className="text-xs text-emerald-400" role="status">
              Profile updated successfully!
            </p>
          )}

          <button
            type="submit"
            disabled={profileLoading}
            className="rounded-full bg-dream-500 px-4 py-2 text-sm font-medium text-night-900 shadow-glow transition hover:bg-dream-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {profileLoading ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>

      {/* Password Change */}
      <section className="rounded-3xl border border-slate-800 bg-night-800/70 p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Change Password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="currentPassword" className="text-xs font-medium text-slate-300">
              Current Password
            </label>
            <input
              id="currentPassword"
              type="password"
              required
              className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="newPassword" className="text-xs font-medium text-slate-300">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={6}
              className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="text-xs font-medium text-slate-300">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={6}
              className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {passwordError && (
            <p className="text-xs text-rose-400" role="alert">
              {passwordError}
            </p>
          )}
          {passwordSuccess && (
            <p className="text-xs text-emerald-400" role="status">
              Password updated successfully!
            </p>
          )}

          <button
            type="submit"
            disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
            className="rounded-full bg-dream-500 px-4 py-2 text-sm font-medium text-night-900 shadow-glow transition hover:bg-dream-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {passwordLoading ? "Updating..." : "Update password"}
          </button>
        </form>
      </section>
    </main>
  );
}

