import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { BlueprintStrip } from './components/BlueprintStrip';
import { Features } from './components/Features';
import { PricingCalculator } from './components/PricingCalculator';
import { CoverageMap } from './components/CoverageMap';
import { TrackingWidget } from './components/TrackingWidget';
import { LeadCaptureModal } from './components/LeadCaptureModal';
import { Footer } from './components/Footer';

export default function App() {
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState(350);

  function handleOpenLeadModal(orders: number = 350) {
    setSelectedOrders(orders);
    setLeadModalOpen(true);
  }

  function handleCloseLeadModal() {
    setLeadModalOpen(false);
  }

  return (
    <div className="website-root">
      {/* Ambient background lighting */}
      <div className="ambient-glow glow-top-right" />
      <div className="ambient-glow glow-middle-left" />
      <div className="ambient-glow glow-bottom-right" />

      {/* Main navigation */}
      <Navbar onOpenLeadModal={() => handleOpenLeadModal(350)} />

      {/* Hero section */}
      <Hero onOpenLeadModal={() => handleOpenLeadModal(350)} />

      {/* Operational 8-stage blueprint */}
      <BlueprintStrip />

      {/* Technical architectural advantages */}
      <Features />

      {/* Interactive pricing calculator */}
      <PricingCalculator onOpenLeadModal={handleOpenLeadModal} />

      {/* Nairobi & regional coverage network */}
      <CoverageMap />

      {/* Real-time milestone parcel tracking */}
      <TrackingWidget />

      {/* Footer */}
      <Footer />

      {/* Merchant onboarding lead modal */}
      <LeadCaptureModal
        isOpen={leadModalOpen}
        initialOrders={selectedOrders}
        onClose={handleCloseLeadModal}
      />
    </div>
  );
}
