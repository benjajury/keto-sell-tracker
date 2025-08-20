import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Package, DollarSign, ShoppingCart, Plus, Check, X, User } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
}

interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    name: string;
  };
}

interface Sale {
  id: string;
  customer_name: string;
  status: 'not_fulfilled' | 'fulfilled';
  total_amount: number;
  sale_date: string;
  sale_items: SaleItem[];
}

interface CartItem {
  product_id: string;
  quantity: number;
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
  
  const [customerName, setCustomerName] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
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

  // Fetch sales with sale items
  const fetchSales = async () => {
    try {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          sale_items (
            *,
            products (name)
          )
        `)
        .order("sale_date", { ascending: false });
      
      if (error) throw error;
      setSales((data || []) as Sale[]);
    } catch (error) {
      console.error("Sales fetch error:", error);
      toast({
        title: "Error", 
        description: `Failed to fetch sales: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Calculate metrics
  const calculateMetrics = (salesData: Sale[], productsData: Product[]) => {
    const totalSales = salesData.length;
    const totalRevenue = salesData.reduce((sum, sale) => sum + sale.total_amount, 0);
    
    let totalUnits = 0;
    let totalProfit = 0;
    
    salesData.forEach(sale => {
      sale.sale_items.forEach(item => {
        totalUnits += item.quantity;
        const product = productsData.find(p => p.id === item.product_id);
        if (product) {
          const itemProfit = (item.unit_price - product.cost) * item.quantity;
          totalProfit += itemProfit;
        }
      });
    });

    setMetrics({
      totalSales,
      totalRevenue,
      totalProfit,
      totalUnits,
    });
  };

  // Add item to cart
  const addToCart = () => {
    if (!selectedProduct || !quantity) {
      toast({
        title: "Error",
        description: "Please select a product and enter quantity",
        variant: "destructive",
      });
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const qty = parseInt(quantity);
    if (qty <= 0 || qty > product.stock) {
      toast({
        title: "Error",
        description: `Invalid quantity. Available stock: ${product.stock}`,
        variant: "destructive",
      });
      return;
    }

    const existingItem = cart.find(item => item.product_id === selectedProduct);
    if (existingItem) {
      setCart(cart.map(item => 
        item.product_id === selectedProduct 
          ? { ...item, quantity: item.quantity + qty }
          : item
      ));
    } else {
      setCart([...cart, { product_id: selectedProduct, quantity: qty }]);
    }

    setSelectedProduct("");
    setQuantity("");
  };

  // Remove item from cart
  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Calculate cart total
  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const product = products.find(p => p.id === item.product_id);
      return total + (product ? product.price * item.quantity : 0);
    }, 0);
  };

  // Handle new sale
  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName.trim()) {
      toast({
        title: "Error",
        description: "Please enter customer name",
        variant: "destructive",
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "Error",
        description: "Please add items to cart",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("=== DEBUG: Starting sale creation ===");
      console.log("Customer name:", customerName.trim());
      console.log("Cart total:", getCartTotal());
      console.log("Cart items:", cart);
      
      // Create sale
      console.log("=== DEBUG: Creating sale record ===");
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert({
          customer_name: customerName.trim(),
          total_amount: getCartTotal(),
          status: 'not_fulfilled'
        })
        .select()
        .single();

      console.log("=== DEBUG: Sale creation result ===");
      console.log("Sale data:", saleData);
      console.log("Sale error:", saleError);

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = cart.map(item => {
        const product = products.find(p => p.id === item.product_id);
        return {
          sale_id: saleData.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: product?.price || 0,
          subtotal: (product?.price || 0) * item.quantity
        };
      });

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Success!",
        description: `Sale recorded for ${customerName}`,
      });

      // Reset form
      setCustomerName("");
      setCart([]);
      
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

  // Mark sale as fulfilled
  const markAsFulfilled = async (saleId: string) => {
    try {
      const { error } = await supabase
        .from("sales")
        .update({ status: 'fulfilled' })
        .eq('id', saleId);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Order marked as fulfilled",
      });

      fetchSales();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update order status",
        variant: "destructive",
      });
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
              <CardDescription>Add a new customer order</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer Name</Label>
                  <Input
                    id="customer"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    className="bg-background"
                  />
                </div>

                <div className="space-y-4">
                  <Label>Add Products</Label>
                  <div className="flex gap-2">
                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                      <SelectTrigger className="bg-background flex-1">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - {formatCurrency(product.price)} (Stock: {product.stock})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Qty"
                      className="bg-background w-20"
                    />
                    <Button type="button" onClick={addToCart} variant="outline">
                      Add
                    </Button>
                  </div>
                </div>

                {/* Cart */}
                {cart.length > 0 && (
                  <div className="space-y-2">
                    <Label>Order Items</Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {cart.map((item) => {
                        const product = products.find(p => p.id === item.product_id);
                        return (
                          <div key={item.product_id} className="flex items-center justify-between p-2 bg-background border rounded">
                            <span className="text-sm">{product?.name} x {item.quantity}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{formatCurrency((product?.price || 0) * item.quantity)}</span>
                              <Button 
                                type="button" 
                                size="sm" 
                                variant="destructive" 
                                onClick={() => removeFromCart(item.product_id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-medium">Total:</span>
                      <span className="font-bold text-lg">{formatCurrency(getCartTotal())}</span>
                    </div>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:opacity-90 transition-all duration-300"
                  disabled={isSubmitting || cart.length === 0}
                >
                  {isSubmitting ? "Recording..." : "Record Sale"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Orders Management */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Orders to Fulfill */}
          <Card className="bg-gradient-card shadow-elegant animate-slide-up [animation-delay:600ms]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-warning" />
                Orders to Fulfill
              </CardTitle>
              <CardDescription>Pending orders that need to be completed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sales.filter(sale => sale.status === 'not_fulfilled').map((sale) => (
                  <div key={sale.id} className="p-4 rounded-lg bg-background border border-warning/20 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-medium text-foreground">{sale.customer_name}</h3>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-warning text-warning-foreground">
                            Pending
                          </span>
                        </div>
                        <div className="space-y-1">
                          {sale.sale_items.map((item) => (
                            <p key={item.id} className="text-sm text-muted-foreground">
                              {item.quantity}x {item.products.name} - {formatCurrency(item.subtotal)}
                            </p>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(sale.sale_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-success mb-2">{formatCurrency(sale.total_amount)}</div>
                        <Button 
                          size="sm" 
                          onClick={() => markAsFulfilled(sale.id)}
                          className="bg-gradient-primary hover:opacity-90"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Fulfill
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {sales.filter(sale => sale.status === 'not_fulfilled').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending orders. Great job!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Fulfilled Orders */}
          <Card className="bg-gradient-card shadow-elegant animate-slide-up [animation-delay:700ms]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-success" />
                Fulfilled Orders
              </CardTitle>
              <CardDescription>Recently completed orders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sales.filter(sale => sale.status === 'fulfilled').slice(0, 10).map((sale) => (
                  <div key={sale.id} className="p-4 rounded-lg bg-background border border-success/20 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-medium text-foreground">{sale.customer_name}</h3>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-success text-success-foreground">
                            Fulfilled
                          </span>
                        </div>
                        <div className="space-y-1">
                          {sale.sale_items.map((item) => (
                            <p key={item.id} className="text-sm text-muted-foreground">
                              {item.quantity}x {item.products.name} - {formatCurrency(item.subtotal)}
                            </p>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(sale.sale_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-success">{formatCurrency(sale.total_amount)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {sales.filter(sale => sale.status === 'fulfilled').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No fulfilled orders yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}