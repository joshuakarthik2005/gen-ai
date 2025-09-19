"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { Settings, LogOut, User, FileText, ArrowLeftRight, Home } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const navigationItems = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/upload", label: "Upload & Analyze", icon: FileText },
    { href: "/compare", label: "Compare Documents", icon: ArrowLeftRight },
  ];

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
      {/* Logo and Navigation */}
      <div className="flex items-center space-x-8">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">ClarityLegal</span>
        </Link>

        {/* Navigation Menu */}
        {isAuthenticated && (
          <nav className="hidden md:flex items-center space-x-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* User Profile */}
      {user && (
        <div className="flex items-center space-x-3 hover:bg-gray-50 rounded-lg p-2 transition-colors">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
            <div className="text-xs text-gray-500">{user.email}</div>
          </div>
          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
            {getInitials(user.full_name)}
          </div>
        </div>
      )}
    </header>
  );
}