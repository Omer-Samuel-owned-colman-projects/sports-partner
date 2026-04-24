ALTER TABLE "games" ADD COLUMN "weather_temp_c" integer;
ALTER TABLE "games" ADD COLUMN "weather_rain_mm" real;
ALTER TABLE "games" ADD COLUMN "weather_fetched_at" timestamp;
ALTER TABLE "games" ADD COLUMN "weather_final" boolean DEFAULT false NOT NULL;
