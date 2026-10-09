'use client';

import {Suspense} from 'react';
import Chat from "@/app/Chat";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Chat/>
    </Suspense>
  );
}