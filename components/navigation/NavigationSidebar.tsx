"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navigationItems } from "@/constants/common";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Session } from "@/lib/auth-client";

interface NavigationSidebarProps {
  currentPath?: string;
  className?: string;
  session?: Session | null;
}

const NavigationSidebar: React.FC<NavigationSidebarProps> = ({ 
  currentPath, 
  className,
  session
}) => {
  const pathname = usePathname();
  const activePath = currentPath || pathname;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <nav className="flex flex-col gap-2 flex-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePath === item.href;
          
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800" 
                  : "border border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className={cn(
                "size-4 shrink-0",
                isActive ? "text-teal-600 dark:text-teal-400" : ""
              )} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      {/* User Profile Section */}
      {session && (
        <Link
          href="/user/profile"
          className={cn(
            "flex items-center gap-3 p-3 rounded-md transition-colors mt-4 border-t",
            activePath === "/user/profile"
              ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800"
              : "hover:bg-accent hover:text-accent-foreground border-border"
          )}
        >
          <Avatar className="size-10 shrink-0">
            <AvatarImage src={session.user?.image ?? undefined} />
            <AvatarFallback className="text-sm font-medium">
              {session.user?.name?.substring(0, 1) ?? ":)"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium truncate">
              {session.user?.name ?? "User"}
            </span>
            {session.user?.email && !session.user?.isAnonymous && (
              <span className="text-xs text-muted-foreground truncate">
                {session.user.email}
              </span>
            )}
          </div>
        </Link>
      )}
    </div>
  );
};

export default NavigationSidebar;