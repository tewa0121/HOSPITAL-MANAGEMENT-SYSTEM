import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

 return (
  <div className="min-h-screen">
    <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <div className="flex min-h-screen flex-col lg:pl-64 print:pl-0">
      <Topbar onMenu={() => setSidebarOpen(true)} />
      <main className="flex-1 p-4 sm:p-6 print:p-0">
        <Outlet />
      </main>
    </div>
  </div>
);
}