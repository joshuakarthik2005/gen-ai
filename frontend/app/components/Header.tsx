"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { Settings, LogOut, User, FileText } from "lucide-react";

export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
      {/* Logo */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-gradient-to-br from-primary-blue to-accent rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <span className="text-heading-3 font-bold text-primary">ClarityLegal</span>
      </div>

      {/* User Profile */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center space-x-3 hover:bg-gray-50 rounded-lg p-2 transition-colors">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">Sarah Chen</div>
              <div className="text-xs text-gray-500">Legal Analyst</div>
            </div>
            <Avatar className="w-8 h-8">
              <AvatarImage src="/avatar.jpg" alt="Sarah Chen" className="rounded-full" />
              <AvatarFallback className="w-8 h-8 bg-primary-blue text-white rounded-full flex items-center justify-center text-sm font-medium">
                SC
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-white border border-gray-200 rounded-lg shadow-elevated p-1">
          <DropdownMenuItem className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-md cursor-pointer">
            <User className="w-4 h-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-md cursor-pointer">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1 h-px bg-gray-200" />
          <DropdownMenuItem className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-md cursor-pointer text-red-600">
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}