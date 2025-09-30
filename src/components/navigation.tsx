"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Database, Mountain } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { path: "/", label: "Daily Run Code", icon: Mountain },
    { path: "/run-data", label: "Run Data", icon: Database },
    { path: "/daily-plans", label: "Daily Plans", icon: Calendar },
  ];

  return (
    <SidebarMenu>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;
        
        return (
          <SidebarMenuItem key={item.path}>
            <SidebarMenuButton asChild isActive={isActive}>
              <Link href={item.path}>
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
