import {
  LayoutDashboard,
  MapPin,
  Truck,
  Fuel,
  Hexagon,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Route,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Live Tracking", url: "/tracking", icon: MapPin },
  { title: "Vehicles", url: "/vehicles", icon: Truck },
  { title: "Route History", url: "/route-history", icon: Route },
  { title: "Fuel Monitoring", url: "/fuel", icon: Fuel },
  { title: "Geofences", url: "/geofences", icon: Hexagon },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar
      collapsible="icon"
      className="bg-gradient-to-b from-slate-900 via-slate-950 to-black border-r border-slate-700/50"
    >
      <SidebarContent className="bg-transparent">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
          <img
            src="/logo.svg"
            alt="Aarov BuildMart"
            className="h-9 w-9 rounded-md object-contain flex-shrink-0 ring-2 ring-slate-600"
          />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-white truncate">
                Aarov BuildMart
              </span>
              <span className="text-[11px] text-slate-400 truncate">
                Fleet Management
              </span>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.url === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-slate-700/70 text-slate-300 hover:text-white transition-all duration-200"
                        activeClassName="bg-gradient-to-r from-slate-600 to-slate-700 text-white font-semibold shadow-lg"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Toggle Button at Bottom */}
      <SidebarFooter className="bg-transparent border-t border-slate-700/50 p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="w-full hover:bg-slate-700/70 text-slate-300 hover:text-white transition-all duration-200"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 mr-2" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
