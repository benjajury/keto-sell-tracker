import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Package, DollarSign, ShoppingCart, Plus } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
}

interface Sale {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  sale_date: string;
  products: {
    name: string;
  };
}

interface Metrics {
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  totalUnits: number;
}

export default function SalesTracker() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalUnits: 0,
  });
  
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();

  // Fetch products
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive",
      });
    }
  };

  // Fetch sales with product names
  const fetchSales = async () => {
    try {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          products!inner(name)
        `)
        .order("sale_date", { ascending: false });
      
      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch sales",
        variant: "destructive",
      });
    }
  };

  // Calculate metrics
  const calculateMetrics = (salesData: Sale[], productsData: Product[]) => {
    const totalSales = salesData.length;
    const totalRevenue = salesData.reduce((sum, sale) => sum + sale.total_amount, 0);
    const totalUnits = salesData.reduce((sum, sale) => sum + sale.quantity, 0);
    
    // Calculate profit by finding the cost for each sale
    const totalProfit = salesData.reduce((sum, sale) => {
      const product = productsData.find(p => p.id === sale.product_id);
      if (product) {
        const saleProfit = (sale.unit_price - product.cost) * sale.quantity;
        return sum + saleProfit;
      }
      return sum;
    }, 0);

    setMetrics({
      totalSales,
      totalRevenue,
      totalProfit,
      totalUnits,
    });
  };

  // Handle new sale
  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct || !quantity) {
      toast({
        title: "Error",
        description: "Please select a product and enter quantity",
        variant: "destructive",
      });
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) {
      toast({
        title: "Error",
        description: "Selected product not found",
        variant: "destructive",
      });
      return;
    }

    const qty = parseInt(quantity);
    if (qty <= 0 || qty > product.stock) {
      toast({
        title: "Error",
        description: `Invalid quantity. Available stock: ${product.stock}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("sales")
        .insert({
          product_id: selectedProduct,
          quantity: qty,
          unit_price: product.price,
          total_amount: product.price * qty,
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Sale recorded: ${qty} x ${product.name}`,
      });

      // Reset form
      setSelectedProduct("");
      setQuantity("");
      
      // Refresh data
      fetchProducts();
      fetchSales();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record sale",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  useEffect(() => {
    fetchProducts();
    fetchSales();
  }, []);

  useEffect(() => {
    calculateMetrics(sales, products);
  }, [sales, products]);

  return (
    <div className="min-h-screen bg-background p-4 animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Keto Sales Tracker</h1>
          <p className="text-muted-foreground">Manage your keto product sales and track performance</p>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-card shadow-elegant animate-slide-up">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.totalSales}</div>
              <p className="text-xs text-muted-foreground">Total transactions</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-elegant animate-slide-up [animation-delay:100ms]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{formatCurrency(metrics.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">Total income</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-success shadow-success animate-slide-up [animation-delay:200ms]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-success-foreground">Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-success-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success-foreground">{formatCurrency(metrics.totalProfit)}</div>
              <p className="text-xs text-success-foreground/80">Net earnings</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-elegant animate-slide-up [animation-delay:300ms]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Units Sold</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.totalUnits}</div>
              <p className="text-xs text-muted-foreground">Total products</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stock Status */}
          <Card className="bg-gradient-card shadow-elegant animate-slide-up [animation-delay:400ms]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Current Stock
              </CardTitle>
              <CardDescription>Live inventory levels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {products.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-background border">
                  <div>
                    <h3 className="font-medium text-foreground">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Price: {formatCurrency(product.price)} | Cost: {formatCurrency(product.cost)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${product.stock <= 5 ? 'text-destructive' : 'text-success'}`}>
                      {product.stock}
                    </div>
                    <div className="text-sm text-muted-foreground">units</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Add Sale Form */}
          <Card className="bg-gradient-card shadow-elegant animate-slide-up [animation-delay:500ms]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Record New Sale
              </CardTitle>
              <CardDescription>Add a new product sale</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product">Product</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {formatCurrency(product.price)} (Stock: {product.stock})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                    className="bg-background"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:opacity-90 transition-all duration-300"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Recording..." : "Record Sale"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Recent Sales */}
        <Card className="bg-gradient-card shadow-elegant animate-slide-up [animation-delay:600ms]">
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>Latest transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sales.slice(0, 10).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg bg-background border hover:shadow-md transition-shadow">
                  <div>
                    <h3 className="font-medium text-foreground">{sale.products.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sale.sale_date).toLocaleDateString()} - {sale.quantity} units
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-success">{formatCurrency(sale.total_amount)}</div>
                    <div className="text-sm text-muted-foreground">{formatCurrency(sale.unit_price)}/unit</div>
                  </div>
                </div>
              ))}
              {sales.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No sales recorded yet. Add your first sale above!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}