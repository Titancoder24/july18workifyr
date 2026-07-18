"use client";

import { useState } from "react";
import { Users, Clock, Plane, CreditCard, Award, Megaphone, ArrowRight } from "lucide-react";

export default function FeatureTabs() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      id: "employees",
      icon: <Users className="size-5" />,
      title: "Employees Directory",
      desc: "A unified, highly-secure database for your entire global workforce. Manage contracts, documents, and personal details.",
      highlights: ["Digital Personnel Files", "Custom Access Roles", "Document Vault"],
    },
    {
      id: "attendance",
      icon: <Clock className="size-5" />,
      title: "Attendance & Leave",
      desc: "Automated tracking, time-offs, and multi-stage managerial approvals. Say goodbye to manual spreadsheets.",
      highlights: ["Geofenced Check-ins", "Automated Accruals", "Manager Approvals"],
    },
    {
      id: "payroll",
      icon: <CreditCard className="size-5" />,
      title: "Payroll Engine",
      desc: "Seamless salary generation linked directly to attendance. One-click compliance across multiple tax jurisdictions.",
      highlights: ["Auto-Calculations", "Tax Withholding", "Direct Deposit Integration"],
    },
    {
      id: "performance",
      icon: <Award className="size-5" />,
      title: "Performance & Goals",
      desc: "Track KPIs, run 360-degree appraisals, and align individual goals with corporate objectives.",
      highlights: ["360 Reviews", "OKRs & KPIs", "Continuous Feedback"],
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 mt-20">
      
      {/* Left side: Interactive Tabs */}
      <div className="lg:col-span-5 space-y-3">
        {tabs.map((tab, idx) => {
          const isActive = activeTab === idx;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(idx)}
              className={`w-full text-left p-5 rounded-2xl transition-all duration-500 border relative overflow-hidden group ${
                isActive 
                  ? "bg-white border-gray-200 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]" 
                  : "bg-transparent border-transparent hover:bg-gray-50/50"
              }`}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-[#40826D]/[0.03] to-transparent pointer-events-none"></div>
              )}
              
              <div className="flex items-center gap-4 relative z-10">
                {/* Figma-Style Icon Container */}
                <div className={`size-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm border ${
                  isActive 
                    ? "bg-gradient-to-b from-white to-[#f0f8f5] border-[#40826D]/20 text-[#40826D]" 
                    : "bg-white border-gray-100 text-gray-400 group-hover:text-gray-600"
                }`}>
                  <div className={isActive ? "drop-shadow-sm" : ""}>
                    {tab.icon}
                  </div>
                </div>
                <div>
                  <h3 className={`text-[17px] font-bold tracking-tight transition-colors ${isActive ? "text-gray-900" : "text-gray-500"}`}>
                    {tab.title}
                  </h3>
                </div>
              </div>
              
              <div className={`transition-all duration-500 overflow-hidden ${isActive ? "max-h-40 mt-4 opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="pl-16">
                  <p className="text-[15px] text-gray-500 leading-relaxed">
                    {tab.desc}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right side: Dynamic Content Pane */}
      <div className="lg:col-span-7">
        <div className="bg-[#FAFAFA] border border-gray-200/60 rounded-[2rem] p-2 h-full min-h-[500px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.08)] relative overflow-hidden group flex flex-col">
          
          {/* Inner Mac Window Styling */}
          <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm flex-1 p-8 md:p-12 relative overflow-hidden flex flex-col">
            
            <div className="absolute top-0 right-0 p-12 opacity-[0.02] transform group-hover:scale-110 transition-transform duration-1000">
              {tabs[activeTab].icon}
            </div>

            <div className="relative z-10 flex flex-col h-full">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200/60 self-start mb-8 shadow-sm">
                <span className="flex h-2 w-2 rounded-full bg-[#40826D] shadow-[0_0_8px_rgba(64,130,109,0.5)]"></span>
                <span className="text-[10px] font-bold text-gray-600 tracking-widest uppercase">HRM Ecosystem</span>
              </div>

              <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-5">
                {tabs[activeTab].title}
              </h2>
              <p className="text-lg text-gray-500 max-w-lg leading-relaxed mb-12">
                {tabs[activeTab].desc}
              </p>

              <div className="mt-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {tabs[activeTab].highlights.map((highlight, i) => (
                    <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-4 transition-all hover:bg-white hover:shadow-md hover:border-gray-200">
                      <div className="size-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center mb-3 shadow-sm">
                        <Award className="size-4 text-[#40826D]" />
                      </div>
                      <span className="text-[13px] font-bold text-gray-800 block">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <button className="mt-12 self-start inline-flex items-center gap-2 text-[14px] font-bold text-black hover:text-[#40826D] transition-colors group/btn">
                Explore Documentation 
                <ArrowRight className="size-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
            
          </div>
        </div>
      </div>

    </div>
  );
}
