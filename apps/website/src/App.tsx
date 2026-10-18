import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { BlueprintStrip } from './components/BlueprintStrip';
import { AboutUs } from './components/AboutUs';
import { ServicesSuite } from './components/ServicesSuite';
import { IndustrySolutions } from './components/IndustrySolutions';
import { PricingCalculator } from './components/PricingCalculator';
import { Features } from './components/Features';
import { CoverageMap } from './components/CoverageMap';
import { TrackingWidget } from './components/TrackingWidget';
import { LeadCaptureModal } from './components/LeadCaptureModal';
import { Footer } from './components/Footer';

export default function App() {
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState(500);

  function handleOpenLeadModal(orders: number = 500) {
    setSelectedOrders(orders);
    setLeadModalOpen(true);
  }

  function handleCloseLeadModal() {
    setLeadModalOpen(false);
  }

  return (
    <div className="website-root">
      {/* 1. Corporate Header & Live Ticker */}
      <Navbar onOpenLeadModal={() => handleOpenLeadModal(500)} />

      {/* 2. Hero Section with Real High-Bay Warehouse Showcase */}
      <Hero onOpenLeadModal={() => handleOpenLeadModal(500)} />

      {/* 3. Closed-Loop Chain of Custody */}
      <BlueprintStrip />

      {/* 4. About Us & Strategic Logistics Hubs (Nairobi, Mombasa, Western, EAC) */}
      <AboutUs />

      {/* 5. Interactive Service Suite (Storage, Courier, Pay on Delivery, Fleet, Freight) */}
      <ServicesSuite onOpenLeadModal={() => handleOpenLeadModal(500)} />

      {/* 6. Sector Solutions for Manufacturers & Distributors */}
      <IndustrySolutions />

      {/* 7. Interactive Logistics Tariff Calculator */}
      <PricingCalculator onOpenLeadModal={handleOpenLeadModal} />

      {/* 8. Operational Intelligence & Fraud Shield Features */}
      <Features />

      {/* 9. Countrywide 47 Counties Coverage Matrix */}
      <CoverageMap />

      {/* 10. Live Consignment & Waybill Tracker */}
      <TrackingWidget />

      {/* 11. Corporate Footer */}
      <Footer />

      {/* 12. Corporate Proposal RFQ Modal */}
      <LeadCaptureModal
        isOpen={leadModalOpen}
        initialOrders={selectedOrders}
        onClose={handleCloseLeadModal}
      />
    </div>
  );
}
