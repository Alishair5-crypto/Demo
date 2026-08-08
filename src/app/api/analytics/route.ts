import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, customers, conversations } from "@/db/schema";
import { eq, and, gte, lte, sum, count, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") ?? "30d";

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "7d": startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case "30d": startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case "90d": startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      case "1y": startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1); break;
      default: startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const userId = session.userId;

    // Revenue over time
    const revenueData: { date: string; revenue: number; orders: number }[] = [];
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 12;
    const isMonthly = period === "1y";

    for (let i = days - 1; i >= 0; i--) {
      let start: Date;
      let end: Date;
      let label: string;

      if (isMonthly) {
        start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        label = start.toLocaleString("default", { month: "short", year: "2-digit" });
      } else {
        start = new Date(now);
        start.setDate(now.getDate() - i);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
        label = start.toLocaleDateString("default", { month: "short", day: "numeric" });
      }

      const [rev] = await db.select({ total: sum(orders.total), cnt: count() }).from(orders)
        .where(and(eq(orders.userId, userId), gte(orders.createdAt, start)));

      revenueData.push({
        date: label,
        revenue: parseFloat(rev?.total ?? "0") || 0,
        orders: rev?.cnt || 0,
      });
    }

    // Customers by lead status
    const leadStatusData = await db.select({
      status: customers.leadStatus,
      count: count(),
    }).from(customers)
      .where(eq(customers.userId, userId))
      .groupBy(customers.leadStatus);

    // Orders by status
    const orderStatusData = await db.select({
      status: orders.status,
      count: count(),
      total: sum(orders.total),
    }).from(orders)
      .where(eq(orders.userId, userId))
      .groupBy(orders.status);

    // Top products
    const allOrders = await db.select({ items: orders.items }).from(orders)
      .where(and(eq(orders.userId, userId), gte(orders.createdAt, startDate)));

    const productCounts: Record<string, { name: string; quantity: number; revenue: number }> = {};
    allOrders.forEach(order => {
      const items = order.items as Array<{ name: string; qty: number; total: number }>;
      if (Array.isArray(items)) {
        items.forEach(item => {
          const key = item.name;
          if (!productCounts[key]) productCounts[key] = { name: item.name, quantity: 0, revenue: 0 };
          productCounts[key].quantity += item.qty;
          productCounts[key].revenue += item.total;
        });
      }
    });

    const topProducts = Object.values(productCounts)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Conversion funnel
    const [totalLeads] = await db.select({ count: count() }).from(customers).where(eq(customers.userId, userId));
    const [qualifiedLeads] = await db.select({ count: count() }).from(customers).where(and(eq(customers.userId, userId), eq(customers.leadStatus, "qualified")));
    const [convertedLeads] = await db.select({ count: count() }).from(customers).where(and(eq(customers.userId, userId), eq(customers.leadStatus, "converted")));
    const [totalOrdersCount] = await db.select({ count: count() }).from(orders).where(eq(orders.userId, userId));

    const conversionFunnel = [
      { stage: "Total Leads", count: totalLeads.count },
      { stage: "Qualified", count: qualifiedLeads.count },
      { stage: "Converted", count: convertedLeads.count },
      { stage: "Orders Placed", count: totalOrdersCount.count },
    ];

    return NextResponse.json({
      revenueData,
      leadStatusData,
      orderStatusData,
      topProducts,
      conversionFunnel,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
