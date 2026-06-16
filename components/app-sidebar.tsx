"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  TrendingUp,
  DollarSign,
  PiggyBank,
  Link2,
  ListOrdered,
  Settings,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { LbLogo } from "@/components/lb-logo"

const nav = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/ons", label: "Obligaciones Negociables", icon: TrendingUp },
  { href: "/soberanos", label: "Soberanos Hard Dollar", icon: DollarSign },
  { href: "/soberanos-ars", label: "Soberanos ARS", icon: PiggyBank },
  { href: "/dlk", label: "Dólar Linked", icon: Link2 },
  { href: "/todos-los-tickers", label: "Todos los tickers", icon: ListOrdered },
]

const tools = [{ href: "/admin", label: "Administración", icon: Settings }]

export function AppSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <LbLogo className="h-6 w-auto text-sidebar-foreground group-data-[collapsible=icon]:hidden" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboards</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Herramientas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tools.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <span className="text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          LB Finanzas
        </span>
      </SidebarFooter>
    </Sidebar>
  )
}
