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
            <h1 className="text-2xl md:text-4xl font-bold text-gray-800">
              SmartSaveAI Style Guide
            </h1>
            <p className="text-xs md:text-sm text-gray-600 mt-2">
              Component library and design system
            </p>
          </div>
          <Link
            href="/"
            className="text-teal-500 hover:text-teal-600 transition cursor-pointer text-sm font-semibold"
          >
            ← Back to Home
          </Link>
        </div>
      </CardHeader>

      <div className="space-y-6">
        {/* Colors */}
        <Card>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Color Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="bg-blue-600 h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-gray-700">Primary Blue</p>
              <p className="text-xs text-gray-500">bg-blue-600</p>
            </div>
            <div>
              <div className="bg-teal-500 h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-gray-700">Teal</p>
              <p className="text-xs text-gray-500">bg-teal-500</p>
            </div>
            <div>
              <div className="bg-green-500 h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-gray-700">Success Green</p>
              <p className="text-xs text-gray-500">bg-green-500</p>
            </div>
            <div>
              <div className="bg-yellow-500 h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-gray-700">Warning Yellow</p>
              <p className="text-xs text-gray-500">bg-yellow-500</p>
            </div>
            <div>
              <div className="bg-red-600 h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-gray-700">Danger Red</p>
              <p className="text-xs text-gray-500">bg-red-600</p>
            </div>
            <div>
              <div className="bg-orange-600 h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-gray-700">Warning Orange</p>
              <p className="text-xs text-gray-500">bg-orange-600</p>
            </div>
            <div>
              <div className="bg-gray-400 h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-gray-700">Neutral Gray</p>
              <p className="text-xs text-gray-500">bg-gray-400</p>
            </div>
            <div>
              <div className="bg-gradient-to-br from-blue-500 to-green-400 h-20 rounded-lg mb-2"></div>
              <p className="text-sm font-semibold text-gray-700">Gradient BG</p>
              <p className="text-xs text-gray-500">from-blue to-green</p>
            </div>
          </div>
        </Card>

        {/* Badges */}
        <Card>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Badges</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Standard Badges</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="green">Green Badge</Badge>
                <Badge variant="blue">Blue Badge</Badge>
                <Badge variant="yellow">Yellow Badge</Badge>
                <Badge variant="teal">Teal Badge</Badge>
                <Badge variant="red">Red Badge</Badge>
                <Badge variant="orange">Orange Badge</Badge>
                <Badge variant="gray">Gray Badge</Badge>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Sized Badges</h3>
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="green" size="sm">Small</Badge>
                <Badge variant="green" size="md">Medium</Badge>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Special Badges</h3>
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
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Buttons</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Button Variants</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary">Primary</Button>
                <Button variant="teal">Teal</Button>
                <Button variant="yellow">Yellow</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="secondary">Secondary</Button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Button Sizes</h3>
              <div className="flex flex-wrap gap-2 items-center">
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="md">Medium</Button>
                <Button variant="primary" size="lg">Large</Button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Disabled State</h3>
              <Button variant="primary" disabled>Disabled Button</Button>
            </div>
          </div>
        </Card>

        {/* Price Classifications */}
        <Card>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Price Classifications</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <PriceClassification type="best" />
              <span className="text-gray-500">→</span>
              <PriceClassification type="best" mobile />
            </div>
            <div className="flex items-center gap-4">
              <PriceClassification type="close" />
              <span className="text-gray-500">→</span>
              <PriceClassification type="close" mobile />
            </div>
            <div className="flex items-center gap-4">
              <PriceClassification type="skip" />
              <span className="text-gray-500">→</span>
              <PriceClassification type="skip" mobile />
            </div>
          </div>
        </Card>

        {/* Coverage Indicator */}
        <Card>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Coverage Indicators</h2>
          <div className="space-y-2">
            <CoverageIndicator coverage={8} total={8} />
            <CoverageIndicator coverage={7} total={8} />
            <CoverageIndicator coverage={3} total={8} />
          </div>
        </Card>

        {/* Favorite Stars */}
        <Card>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Favorite Stars</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FavoriteStar isFavorite={true} size="sm" />
              <span className="text-sm">Small</span>
            </div>
            <div className="flex items-center gap-2">
              <FavoriteStar isFavorite={true} size="md" />
              <span className="text-sm">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <FavoriteStar isFavorite={true} size="lg" />
              <span className="text-sm">Large</span>
            </div>
            <div className="flex items-center gap-2">
              <FavoriteStar isFavorite={true} size="xl" />
              <span className="text-sm">XL</span>
            </div>
            <div className="flex items-center gap-2">
              <FavoriteStar isFavorite={true} size="2xl" />
              <span className="text-sm">2XL</span>
            </div>
          </div>
        </Card>

        {/* Price Input */}
        <Card>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Price Input</h2>
          <div className="max-w-xs">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Enter Price
            </label>
            <PriceInput
              value={priceValue}
              onChange={setPriceValue}
            />
            <p className="text-xs text-gray-500 mt-2">
              Current value: ${priceValue || '0.00'}
            </p>
          </div>
        </Card>

        {/* Date Age */}
        <Card>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Date Age Display</h2>
          <div className="space-y-2 text-sm">
            <div>Price recorded <DateAge date={new Date().toISOString()} /></div>
            <div>Price recorded <DateAge date={new Date(Date.now() - 86400000).toISOString()} /></div>
            <div>Price recorded <DateAge date={new Date(Date.now() - 86400000 * 7).toISOString()} /></div>
            <div>Price recorded <DateAge date={new Date(Date.now() - 86400000 * 30).toISOString()} /></div>
          </div>
        </Card>

        {/* Section Headers */}
        <Card>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Section Headers</h2>
          <div className="space-y-4">
            <SectionHeader title="Your Shopping List" count={8} />
            <SectionHeader 
              title="Best Stores" 
              action={{ label: 'Clear All', onClick: () => {}, variant: 'danger' }} 
            />
          </div>
        </Card>

        {/* Empty State */}
        <Card>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Empty State</h2>
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
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Typography</h2>
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-800">Heading 1 (4xl)</h1>
              <p className="text-xs text-gray-500">Page titles</p>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Heading 2 (2xl)</h2>
              <p className="text-xs text-gray-500">Section titles</p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Heading 3 (xl)</h3>
              <p className="text-xs text-gray-500">Subsection titles</p>
            </div>
            <div>
              <p className="text-base text-gray-800">Body text (base)</p>
              <p className="text-xs text-gray-500">Main content</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Small text (sm)</p>
              <p className="text-xs text-gray-500">Secondary information</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Extra small (xs)</p>
              <p className="text-xs text-gray-500">Helper text, labels</p>
            </div>
          </div>
        </Card>

        {/* Spacing */}
        <Card>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Spacing</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Padding</p>
              <div className="flex gap-4">
                <div className="bg-blue-100 p-2 rounded">p-2</div>
                <div className="bg-blue-100 p-3 rounded">p-3</div>
                <div className="bg-blue-100 p-4 rounded">p-4</div>
                <div className="bg-blue-100 p-6 rounded">p-6</div>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Gaps</p>
              <div className="flex gap-2">
                <div className="bg-teal-100 p-2 rounded">gap-2</div>
                <div className="bg-teal-100 p-2 rounded">between</div>
                <div className="bg-teal-100 p-2 rounded">items</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Border Radius */}
        <Card>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Border Radius</h2>
          <div className="flex gap-4 items-center">
            <div className="bg-gray-200 w-20 h-20 rounded p-2 text-xs">rounded</div>
            <div className="bg-gray-200 w-20 h-20 rounded-lg p-2 text-xs">rounded-lg</div>
            <div className="bg-gray-200 px-4 py-2 rounded-full text-xs">rounded-full</div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}