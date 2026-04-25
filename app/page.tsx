import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Monitor, Users, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="relative py-20 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 glow-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
            Gaming Rental System
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Premium gaming experience with high-end PCs, PS5 consoles, and VIP rooms. 
            Book your slot now and elevate your gaming.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/customer">
              <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 text-lg glow-border">
                <Gamepad2 className="mr-2 h-5 w-5" />
                Book Now
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 px-8 py-6 text-lg">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 glow-text">
            Our Gaming Stations
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* PC Gaming */}
            <Card className="bg-gaming-card border-cyan-500/20 glow-border">
              <CardHeader>
                <Monitor className="h-12 w-12 text-cyan-400 mb-4" />
                <CardTitle className="text-xl text-white">Gaming PCs</CardTitle>
                <CardDescription className="text-gray-400">
                  High-end RTX 4090 gaming rigs with 240Hz monitors
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li>• Intel i9 / AMD Ryzen 9</li>
                  <li>• NVIDIA RTX 4090</li>
                  <li>• 32GB DDR5 RAM</li>
                  <li>• 240Hz 2K Monitors</li>
                </ul>
              </CardContent>
            </Card>

            {/* PS5 */}
            <Card className="bg-gaming-card border-cyan-500/20 glow-border">
              <CardHeader>
                <Gamepad2 className="h-12 w-12 text-purple-400 mb-4" />
                <CardTitle className="text-xl text-white">PlayStation 5</CardTitle>
                <CardDescription className="text-gray-400">
                  Latest PS5 consoles with premium controllers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li>• PlayStation 5 Console</li>
                  <li>• DualSense Edge Controller</li>
                  <li>• 4K 120Hz TV</li>
                  <li>• Premium Gaming Chair</li>
                </ul>
              </CardContent>
            </Card>

            {/* VIP Rooms */}
            <Card className="bg-gaming-card border-cyan-500/20 glow-border">
              <CardHeader>
                <Users className="h-12 w-12 text-pink-400 mb-4" />
                <CardTitle className="text-xl text-white">VIP Rooms</CardTitle>
                <CardDescription className="text-gray-400">
                  Private rooms for teams and streaming
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li>• Private Gaming Room</li>
                  <li>• Multiple Gaming Stations</li>
                  <li>• Streaming Setup</li>
                  <li>• Lounge Area</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-12 px-4 border-t border-cyan-500/20">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <Zap className="h-8 w-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">50+</div>
            <div className="text-sm text-gray-400">Gaming Stations</div>
          </div>
          <div>
            <Users className="h-8 w-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">1000+</div>
            <div className="text-sm text-gray-400">Happy Gamers</div>
          </div>
          <div>
            <Monitor className="h-8 w-8 text-pink-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">4K</div>
            <div className="text-sm text-gray-400">Gaming Experience</div>
          </div>
          <div>
            <Gamepad2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">24/7</div>
            <div className="text-sm text-gray-400">Available</div>
          </div>
        </div>
      </section>
    </div>
  );
}
