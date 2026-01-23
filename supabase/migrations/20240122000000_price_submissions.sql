-- Create price_submissions table for user-submitted price photos
CREATE TABLE IF NOT EXISTS price_submissions (
  id BIGSERIAL PRIMARY KEY,
  household_code TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  
  -- Extracted data from price tag
  store_item_number TEXT, -- e.g., Costco SKU
  item_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2), -- pre-discount price
  discount_amount DECIMAL(10,2), -- savings amount
  store_id UUID REFERENCES stores(id), -- Changed from INTEGER to UUID
  unit_size TEXT, -- e.g., "5 LBS", "6/32 FL OZ"
  
  -- Validation data
  store_unit_price TEXT, -- store's calculated unit price (e.g., "$1.098/lb")
  
  -- Sale tracking
  is_sale BOOLEAN DEFAULT false,
  sale_expiration DATE, -- when sale ends
  
  -- Metadata
  image_url TEXT,
  confidence_score DECIMAL(3,2),
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (household_code) REFERENCES households(code)
);

-- Indexes for performance
CREATE INDEX idx_price_submissions_household ON price_submissions(household_code);
CREATE INDEX idx_price_submissions_verified ON price_submissions(verified);
CREATE INDEX idx_price_submissions_store_item ON price_submissions(store_item_number);
CREATE INDEX idx_price_submissions_sale ON price_submissions(is_sale, sale_expiration);

-- Update price_history table to track source
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
-- values: 'manual', 'photo', 'scraper', 'api'

ALTER TABLE price_history ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id);

-- Comment on table
COMMENT ON TABLE price_submissions IS 'User-submitted price photos for crowdsourcing price data';
