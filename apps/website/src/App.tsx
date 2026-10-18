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
import { Faq } from './components/Faq';
import { trackMarketingEvent } from './utils/analytics';

export default function App() {
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState(500);

  function handleOpenLeadModal(orders: number = 500) {
    trackMarketingEvent('quote_opened');
    setSelectedOrders(orders);
    setLeadModalOpen(true);
  }

  function handleCloseLeadModal() {
    setLeadModalOpen(false);
  }

  const path = window.location.pathname;
  const query = new URLSearchParams(window.location.search);
  if (path === '/track') {
    return (
      <div className="website-root">
        <Navbar onOpenLeadModal={() => { window.location.href = '/request-quote'; }} />
        <main className="dedicated-page"><TrackingWidget initialTrackingNumber={query.get('waybill') ?? ''} /></main>
        <Footer />
      </div>
    );
  }
  if (path === '/request-quote') {
    return (
      <div className="website-root">
        <Navbar onOpenLeadModal={() => undefined} />
        <main>
          <LeadCaptureModal isOpen initialOrders={Number(query.get('orders')) || 500} standalone onClose={() => { window.location.href = '/'; }} />
        </main>
      </div>
    );
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

      <Faq />

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
