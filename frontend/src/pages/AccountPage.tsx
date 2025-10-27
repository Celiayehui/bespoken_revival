import React from 'react';
import { Card } from '../components/ui/card';
import { User, Trophy, MessageCircle, TrendingUp, LogOut, ArrowLeft } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AccountPageProps {
  userName: string;
  userEmail: string;
  isGuest: boolean;
  completedScenariosCount: number;
  totalTurnsCompleted: number;
  weeklyActivityData: Array<{ day: string; turns: number }>;
  onLogout: () => void;
  onBack: () => void;
}

export default function AccountPage({
  userName,
  userEmail,
  isGuest,
  completedScenariosCount,
  totalTurnsCompleted,
  weeklyActivityData,
  onLogout,
  onBack
}: AccountPageProps) {
  return (
    <div className="w-[390px] h-[844px] bg-white mx-auto flex flex-col">
      {/* Header */}
      <div className="pt-12 pb-6 px-5 border-b border-gray-100">
        <div className="flex items-center mb-4">
          <button
            onClick={onBack}
            className="mr-3 p-2 hover:bg-gray-100 rounded-lg transition-all"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">My Account</h1>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* Profile Section */}
        <Card className="bg-white shadow-md rounded-xl p-5 border border-gray-100 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-gray-900 truncate">{userName}</h2>
              <p className="text-sm text-gray-600 truncate">{userEmail}</p>
              {isGuest && (
                <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                  Guest Account
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Key Stats */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 mb-3">Key Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Scenarios Completed */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-900">{completedScenariosCount}</div>
              <div className="text-xs text-blue-700">Scenarios Completed</div>
            </Card>

            {/* Total Turns */}
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-900">{totalTurnsCompleted}</div>
              <div className="text-xs text-green-700">Total Turns</div>
            </Card>
          </div>
        </div>

        {/* Weekly Activity Chart */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-900">Weekly Activity</h3>
          </div>
          <Card className="bg-white shadow-md rounded-xl p-4 border border-gray-100">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  cursor={{ fill: '#f3f4f6' }}
                />
                <Bar 
                  dataKey="turns" 
                  fill="#3b82f6" 
                  radius={[8, 8, 0, 0]}
                  name="Turns Completed"
                />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 text-center mt-3">
              Number of conversation turns completed this week
            </p>
          </Card>
        </div>
      </div>

      {/* Logout Button - Fixed at Bottom */}
      <div className="px-5 pb-8 pt-4 bg-white border-t border-gray-100">
        <button
          onClick={onLogout}
          className="w-full h-12 bg-white text-red-600 border-2 border-red-600 rounded-lg hover:bg-red-50 transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
}
