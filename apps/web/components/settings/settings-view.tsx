'use client';

import type { ReactNode } from 'react';
import { PaletteIcon, UserIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppearanceMode } from './appearance-mode';

/**
 * The tabbed body of the user settings page (components/ui/tabs.tsx, Base UI).
 * Appearance is self-contained on the client (it talks to next-themes), while
 * Account is a server-rendered slot passed in from the page so the DAL's
 * getCurrentUser() can stay behind its own <Suspense> boundary.
 */
export function SettingsView({ account }: { account: ReactNode }) {
  return (
    <Tabs defaultValue="appearance" className="w-full" aria-label="Settings sections">
      <TabsList variant="line" className="w-full border-b px-0 *:-mb-1">
        <TabsTrigger value="appearance">
          <PaletteIcon />
          Appearance
        </TabsTrigger>
        <TabsTrigger value="account">
          <UserIcon />
          Account
        </TabsTrigger>
      </TabsList>
      <TabsContent value="appearance">
        <Card ghost>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>
              Choose how Farraza looks. “System” follows your device’s appearance setting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AppearanceMode />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="account">{account}</TabsContent>
    </Tabs>
  );
}
