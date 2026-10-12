'use client';
import React from 'react';
import Link from 'next/link';
import {
  PageContainer,
  Card,
  CardHeader,
  Badge,
  BestDealBadge,
  CheckmarkBadge,
  Button,
  PriceClassification,
  CoverageIndicator,
  FavoriteStar,
  PriceInput,
  StoreBadge,
  EmptyState,
  SectionHeader,
  DateAge,
  ItemRow,
} from '../components/ui';

export default function StyleGuide() {
  const [priceValue, setPriceValue] = React.useState('');

  return (
    <PageContainer>
      <CardHeader className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-bb-cream">
              SmartSaveAI Style Guide
            </h1>
            <p className="text-xs md:text-sm text-bb-muted mt-2">
              Component library and design system
            </p>
          </div>
          <Link
            href="/"
            className="text-bb-muted hover:text-bb-cream transition cursor-pointer text-sm font-semibold"
          >
            ← Back to Home
          </Link>
        </div>
      </CardHeader>

      <div className="space-y-6">
        {/* Colors */}
        <Card>
          <h2 className="text-2xl font-bold text-bb-cream mb-4">Color Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="bg-bb-navy border border-bb-line h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-bb-cream">Navy</p>
              <p className="text-xs text-bb-muted">bg-bb-navy · page background; text on gold</p>
            </div>
            <div>
              <div className="bg-bb-panel border border-bb-line h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-bb-cream">Panel</p>
              <p className="text-xs text-bb-muted">bg-bb-panel · cards, panels, modals</p>
            </div>
            <div>
              <div className="bg-bb-raised border border-bb-line h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-bb-cream">Raised</p>
              <p className="text-xs text-bb-muted">bg-bb-raised · rows, inputs, hover</p>
            </div>
            <div>
              <div className="bg-bb-line border border-bb-line h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-bb-cream">Line</p>
              <p className="text-xs text-bb-muted">bg-bb-line · borders, dividers</p>
            </div>
            <div>
              <div className="bg-bb-cream border border-bb-line h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-bb-cream">Cream</p>
              <p className="text-xs text-bb-muted">bg-bb-cream · primary text</p>
            </div>
            <div>
              <div className="bg-bb-muted border border-bb-line h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-bb-cream">Muted</p>
              <p className="text-xs text-bb-muted">bg-bb-muted · secondary text, labels</p>
            </div>
            <div>
              <div className="bg-bb-gold border border-bb-line h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-bb-cream">Gold</p>
              <p className="text-xs text-bb-muted">bg-bb-gold · the one accent / primary</p>
            </div>
            <div>
              <div className="bg-bb-green border border-bb-line h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-bb-cream">Green</p>
              <p className="text-xs text-bb-muted">bg-bb-green · savings, success</p>
            </div>
            <div>
              <div className="bg-bb-red border border-bb-line h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-bb-cream">Red</p>
              <p className="text-xs text-bb-muted">bg-bb-red · price up, destructive</p>
            </div>
            <div>
              <div className="app-bg border border-bb-line h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-bb-cream">Page Background</p>
              <p className="text-xs text-bb-muted">app-bg</p>
            </div>
          </div>
        </Card>

        {/* Badges */}
        <Card>
          <h2 className="text-2xl font-bold text-bb-cream mb-4">Badges</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-bb-cream mb-2">Standard Badges</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="green">green · savings</Badge>
                <Badge variant="blue">blue · neutral</Badge>
                <Badge variant="yellow">yellow · warning</Badge>
                <Badge variant="teal">teal · neutral</Badge>
                <Badge variant="red">red · price up</Badge>
                <Badge variant="orange">orange · warning</Badge>
                <Badge variant="gray">gray · neutral</Badge>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-bb-cream mb-2">Sized Badges</h3>
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="green" size="sm">Small</Badge>
                <Badge variant="green" size="md">Medium</Badge>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-bb-cream mb-2">Special Badges</h3>
              <div className="flex flex-wrap gap-2">
                <BestDealBadge />
                <CheckmarkBadge />
                <StoreBadge store="Acme" />
              </div>
            </div>
          </div>
        </Card>

        {/* Buttons */}
        <Card>
          <h2 className="text-2xl font-bold text-bb-cream mb-4">Buttons</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-bb-cream mb-2">Button Variants</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary">Primary</Button>
                <Button variant="teal">Teal (secondary)</Button>
                <Button variant="yellow">Yellow (primary)</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="secondary">Secondary</Button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-bb-cream mb-2">Button Sizes</h3>
              <div className="flex flex-wrap gap-2 items-center">
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="md">Medium</Button>
                <Button variant="primary" size="lg">Large</Button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-bb-cream mb-2">Disabled State</h3>
              <Button variant="primary" disabled>Disabled Button</Button>
            </div>
          </div>
        </Card>

        {/* Price Classifications */}
        <Card>
          <h2 className="text-2xl font-bold text-bb-cream mb-4">Price Classifications</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <PriceClassification type="best" />
              <span className="text-bb-muted">→</span>
              <PriceClassification type="best" mobile />
            </div>
            <div className="flex items-center gap-4">
              <PriceClassification type="close" />
              <span className="text-bb-muted">→</span>
              <PriceClassification type="close" mobile />
            </div>
            <div className="flex items-center gap-4">
              <PriceClassification type="skip" />
              <span className="text-bb-muted">→</span>
              <PriceClassification type="skip" mobile />
            </div>
          </div>
        </Card>

        {/* Coverage Indicator */}
        <Card>
          <h2 className="text-2xl font-bold text-bb-cream mb-4">Coverage Indicators</h2>
          <div className="space-y-2">
            <CoverageIndicator coverage={8} total={8} />
            <CoverageIndicator coverage={7} total={8} />
            <CoverageIndicator coverage={3} total={8} />
          </div>
        </Card>

        {/* Favorite Stars */}
        <Card>
          <h2 className="text-2xl font-bold text-bb-cream mb-4">Favorite Stars</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FavoriteStar isFavorite={true} size="sm" />
              <span className="text-sm text-bb-cream">Small</span>
            </div>
            <div className="flex items-center gap-2">
              <FavoriteStar isFavorite={true} size="md" />
              <span className="text-sm text-bb-cream">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <FavoriteStar isFavorite={true} size="lg" />
              <span className="text-sm text-bb-cream">Large</span>
            </div>
            <div className="flex items-center gap-2">
              <FavoriteStar isFavorite={true} size="xl" />
              <span className="text-sm text-bb-cream">XL</span>
            </div>
            <div className="flex items-center gap-2">
              <FavoriteStar isFavorite={true} size="2xl" />
              <span className="text-sm text-bb-cream">2XL</span>
            </div>
          </div>
        </Card>

        {/* Price Input */}
        <Card>
          <h2 className="text-2xl font-bold text-bb-cream mb-4">Price Input</h2>
          <div className="max-w-xs">
            <label className="block text-sm font-semibold text-bb-cream mb-2">
              Enter Price
            </label>
            <PriceInput
              value={priceValue}
              onChange={setPriceValue}
            />
            <p className="text-xs text-bb-muted mt-2">
              Current value: ${priceValue || '0.00'}
            </p>
          </div>
        </Card>

        {/* Date Age */}
        <Card>
          <h2 className="text-2xl font-bold text-bb-cream mb-4">Date Age Display</h2>
          <div className="space-y-2 text-sm text-bb-cream">
            <div>Price recorded <DateAge date={new Date().toISOString()} /></div>
            <div>Price recorded <DateAge date={new Date(Date.now() - 86400000).toISOString()} /></div>
            <div>Price recorded <DateAge date={new Date(Date.now() - 86400000 * 7).toISOString()} /></div>
            <div>Price recorded <DateAge date={new Date(Date.now() - 86400000 * 30).toISOString()} /></div>
          </div>
        </Card>

        {/* Section Headers */}
        <Card>
          <h2 className="text-2xl font-bold text-bb-cream mb-4">Section Headers</h2>
          <div className="space-y-4">
            <SectionHeader title="Your Shopping List" count={8} />
            <SectionHeader
              title="Best Stores"
              action={{ label: 'Clear All', onClick: () => { }, variant: 'danger' }}
            />
          </div>
        </Card>

        {/* Empty State */}
        <Card>
          <h2 className="text-2xl font-bold text-bb-cream mb-4">Empty State</h2>
          <EmptyState
            title="Your shopping list is empty"
            message="Add some items to get started"
            action={{
              label: 'Add Items',
              onClick: () => alert('Add items clicked!')
            }}
          />
        </Card>

        {/* Typography */}
        <Card>
          <h2 className="text-2xl font-bold text-bb-cream mb-4">Typography</h2>
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold text-bb-cream">Heading 1 (4xl)</h1>
              <p className="text-xs text-bb-muted">Page titles</p>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-bb-cream">Heading 2 (2xl)</h2>
              <p className="text-xs text-bb-muted">Section titles</p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-bb-cream">Heading 3 (xl)</h3>
              <p className="text-xs text-bb-muted">Subsection titles</p>
            </div>
            <div>
              <p className="text-base text-bb-cream">Body text (base)</p>
              <p className="text-xs text-bb-muted">Main content</p>
            </div>
            <div>
              <p className="text-sm text-bb-muted">Small text (sm)</p>
              <p className="text-xs text-bb-muted">Secondary information</p>
            </div>
            <div>
              <p className="text-xs text-bb-muted">Extra small (xs)</p>
              <p className="text-xs text-bb-muted">Helper text, labels</p>
            </div>
          </div>
        </Card>

        {/* Spacing */}
        <Card>
          <h2 className="text-2xl font-bold text-bb-cream mb-4">Spacing</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-bb-cream mb-2">Padding</p>
              <div className="flex gap-4">
                <div className="bg-bb-raised border border-bb-line text-bb-cream p-2 rounded">p-2</div>
                <div className="bg-bb-raised border border-bb-line text-bb-cream p-3 rounded">p-3</div>
                <div className="bg-bb-raised border border-bb-line text-bb-cream p-4 rounded">p-4</div>
                <div className="bg-bb-raised border border-bb-line text-bb-cream p-6 rounded">p-6</div>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-bb-cream mb-2">Gaps</p>
              <div className="flex gap-2">
                <div className="bg-bb-raised border border-bb-line text-bb-cream p-2 rounded">gap-2</div>
                <div className="bg-bb-raised border border-bb-line text-bb-cream p-2 rounded">between</div>
                <div className="bg-bb-raised border border-bb-line text-bb-cream p-2 rounded">items</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Border Radius */}
        <Card>
          <h2 className="text-2xl font-bold text-bb-cream mb-4">Border Radius</h2>
          <div className="flex gap-4 items-center">
            <div className="bg-bb-raised w-20 h-20 rounded p-2 text-xs text-bb-cream">rounded</div>
            <div className="bg-bb-raised w-20 h-20 rounded-lg p-2 text-xs text-bb-cream">rounded-lg</div>
            <div className="bg-bb-raised px-4 py-2 rounded-full text-xs text-bb-cream">rounded-full</div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}