"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar, Database, Mountain} from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { path: "/", label: "Daily Run Code", icon: Mountain },
    { path: "/run-data", label: "Run Data", icon: Database },
    { path: "/daily-plans", label: "Daily Plans", icon: Calendar },
  ];

  return (
    <nav className="flex flex-col space-y-2 p-4">
      <div className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          
          return (
            <Link key={item.path} href={item.path}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={`w-full justify-start ${
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              >
                <Icon className="w-5 h-5 mr-3" />
                <span className="font-medium">{item.label}</span>
              </Button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
