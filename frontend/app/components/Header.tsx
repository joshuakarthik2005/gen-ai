"use client";

import { Settings, User, FileText } from "lucide-react";

export default function Header() {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Default user info for demo
  const user = {
    full_name: "Joshua Karthik",
    email: "joshuakarthik2005@gmail.com"
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
      {/* Logo */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900">ClarityLegal</span>
      </div>

      {/* User Profile */}
      <div className="flex items-center space-x-3 hover:bg-gray-50 rounded-lg p-2 transition-colors">
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
          <div className="text-xs text-gray-500">{user.email}</div>
        </div>
        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
          {getInitials(user.full_name)}
        </div>
      </div>
    </header>
  );
}