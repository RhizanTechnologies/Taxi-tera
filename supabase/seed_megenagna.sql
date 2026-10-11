-- ============================================================
-- 10 Authentic Megenagna Taxi Stations & Lines Seed
-- Run in: Supabase Dashboard -> SQL Editor
-- ============================================================

do $$
declare
  st_bole       uuid := gen_random_uuid();
  st_ararkilo   uuid := gen_random_uuid();
  st_ayat       uuid := gen_random_uuid();
  st_kotebe     uuid := gen_random_uuid();
  st_signal     uuid := gen_random_uuid();
  st_saris      uuid := gen_random_uuid();
  st_gerji      uuid := gen_random_uuid();
  st_shola      uuid := gen_random_uuid();
  st_mexico     uuid := gen_random_uuid();
  st_ferensay   uuid := gen_random_uuid();
begin

  -- 1. መገናኛ - ቦሌ ተራ
  insert into public.stations (id, name_am, name_en, lat, lng, landmark_am, landmark_en, status, last_verified_at)
  values (
    st_bole,
    'መገናኛ ቦሌ ተራ',
    'Megenagna Bole Station',
    9.02035, 38.80215,
    'ከመገናኛ አደባባይ ወደ ቦሌ መታጠፊያ ከእግረኛ ድልድዩ ስር',
    'Under the pedestrian overpass, towards Bole Road',
    'active',
    now()
  );

  insert into public.lines (station_id, destination_am, destination_en, fare_birr, direction, fare_checked_at, sort_order) values
    (st_bole, 'ቦሌ መድኃኔዓለም', 'Bole Medhanialem', 15, 'በቦሌ መንገድ ቀጥታ', now(), 1),
    (st_bole, 'ቦሌ ሚካኤል', 'Bole Michael', 18, 'በአትላስ ሆቴል በኩል', now(), 2),
    (st_bole, 'ቦሌ ሩዋንዳ / ብራስ', 'Bole Rwanda / Brass', 16, 'በብራስ ሆስፒታል በኩል', now(), 3);

  -- 2. መገናኛ - 4 ኪሎ / ፒያሳ ተራ
  insert into public.stations (id, name_am, name_en, lat, lng, landmark_am, landmark_en, status, last_verified_at)
  values (
    st_ararkilo,
    'መገናኛ 4 ኪሎ እና ፒያሳ ተራ',
    'Megenagna 4 Kilo & Piassa Station',
    9.02150, 38.80145,
    'ከዘመን ባንክ ህንፃ ፊት ለፊት ከዋናው መንገድ ዳር',
    'In front of Zemen Bank building along the main avenue',
    'active',
    now()
  );

  insert into public.lines (station_id, destination_am, destination_en, fare_birr, direction, fare_checked_at, sort_order) values
    (st_ararkilo, '4 ኪሎ', 'Arat Kilo', 15, 'በካዛንቺስ በኩል', now(), 1),
    (st_ararkilo, 'ፒያሳ / ጊዮርጊስ', 'Piassa / Giorgis', 18, 'በቴዎድሮስ አደባባይ', now(), 2),
    (st_ararkilo, 'ሽሮሜዳ', 'Shiro Meda', 20, 'በስድስት ኪሎ አድርጎ', now(), 3);

  -- 3. መገናኛ - አያት / ለገጣፎ ተራ
  insert into public.stations (id, name_am, name_en, lat, lng, landmark_am, landmark_en, status, last_verified_at)
  values (
    st_ayat,
    'መገናኛ አያት እና ታፎ ተራ',
    'Megenagna Ayat & Tafo Station',
    9.02240, 38.80380,
    'ከመገናኛ ሞል ጀርባ ወደ ለገጣፎ መውጫ መንገድ',
    'Behind Megenagna Mall on the exit route to Legetafo',
    'active',
    now()
  );

  insert into public.lines (station_id, destination_am, destination_en, fare_birr, direction, fare_checked_at, sort_order) values
    (st_ayat, 'አያት አደባባይ', 'Ayat Roundabout', 15, 'በሲኤምሲ በኩል', now(), 1),
    (st_ayat, 'ሰሚት ኮንዶሚኒየም', 'Summit Condominium', 15, 'በፔፕሲ ፋብሪካ በኩል', now(), 2),
    (st_ayat, 'ለገጣፎ / ለገዳዲ', 'Legetafo / Legedadi', 25, 'በካራ ቀጥታ', now(), 3);

  -- 4. መገናኛ - ኮተቤ / ካራ ተራ
  insert into public.stations (id, name_am, name_en, lat, lng, landmark_am, landmark_en, status, last_verified_at)
  values (
    st_kotebe,
    'መገናኛ ኮተቤ ተራ',
    'Megenagna Kotebe Station',
    9.02315, 38.80290,
    'ከቶታል ነዳጅ ማደያ ጀርባ ወደ ኮተቤ መታጠፊያ',
    'Behind Total Gas Station toward Kotebe Road',
    'active',
    now()
  );

  insert into public.lines (station_id, destination_am, destination_en, fare_birr, direction, fare_checked_at, sort_order) values
    (st_kotebe, 'ኮተቤ 02 / ኮሌጅ', 'Kotebe 02 / College', 12, 'በኮተቤ ብረታብረት', now(), 1),
    (st_kotebe, 'ሃና ማርያም ኮተቤ', 'Hana Mariam Kotebe', 14, 'በኮተቤ መንገድ ቀጥታ', now(), 2),
    (st_kotebe, 'ካራ ቆሬ', 'Kara Kore', 18, 'በአስኮ መስመር', now(), 3);

  -- 5. መገናኛ - ሲግናል / ሲኤምሲ ተራ
  insert into public.stations (id, name_am, name_en, lat, lng, landmark_am, landmark_en, status, last_verified_at)
  values (
    st_signal,
    'መገናኛ ሲግናል እና ሲኤምሲ ተራ',
    'Megenagna Signal & CMC Station',
    9.02110, 38.80435,
    'ከመገናኛ ቀላል ባቡር ጣቢያ (LRT) መግቢያ አጠገብ',
    'Next to Megenagna Light Rail Transit entrance',
    'active',
    now()
  );

  insert into public.lines (station_id, destination_am, destination_en, fare_birr, direction, fare_checked_at, sort_order) values
    (st_signal, 'ሲግናል', 'Signal', 10, 'በቀጥታ መስመር', now(), 1),
    (st_signal, 'ሲኤምሲ ሚካኤል', 'CMC Michael', 14, 'በሲኤምሲ አደባባይ', now(), 2),
    (st_signal, 'ፀበል / መሪ ሎቄ', 'Meri / Tsebel', 16, 'በፀበል መታጠፊያ', now(), 3);

  -- 6. መገናኛ - ሳሪስ / ቃሊቲ ተራ
  insert into public.stations (id, name_am, name_en, lat, lng, landmark_am, landmark_en, status, last_verified_at)
  values (
    st_saris,
    'መገናኛ ሳሪስ እና ቃሊቲ ተራ',
    'Megenagna Saris & Kality Station',
    9.01915, 38.80280,
    'ወደ ቀለበት መንገድ መውረጃ ከጎተራ መታጠፊያ አቅራቢያ',
    'Slip road onto Ring Road heading towards Saris',
    'active',
    now()
  );

  insert into public.lines (station_id, destination_am, destination_en, fare_birr, direction, fare_checked_at, sort_order) values
    (st_saris, 'ሳሪስ አቦ', 'Saris Abo', 20, 'በቀለበት መንገድ', now(), 1),
    (st_saris, 'ቃሊቲ ማዞሪያ', 'Kality Mazoria', 25, 'በቃሊቲ ጉምሩክ በኩል', now(), 2),
    (st_saris, 'ጎተራ ማሳለጫ', 'Gotera Interchange', 18, 'በጎተራ በኩል', now(), 3);

  -- 7. መገናኛ - ገርጂ / ኢምፔሪያል ተራ
  insert into public.stations (id, name_am, name_en, lat, lng, landmark_am, landmark_en, status, last_verified_at)
  values (
    st_gerji,
    'መገናኛ ገርጂ ተራ',
    'Megenagna Gerji Station',
    9.01850, 38.80095,
    'ከአምቼ (AMCE) መግቢያ ፊት ለፊት ወደ ገርጂ መታጠፊያ',
    'Opposite AMCE entrance towards Gerji junction',
    'active',
    now()
  );

  insert into public.lines (station_id, destination_am, destination_en, fare_birr, direction, fare_checked_at, sort_order) values
    (st_gerji, 'ኢምፔሪያል ሆቴል', 'Imperial Hotel', 12, 'በቀጥታ መንገድ', now(), 1),
    (st_gerji, 'ገርጂ ጃክሮስ', 'Gerji Jackros', 15, 'በአልፎንሶ አደባባይ', now(), 2),
    (st_gerji, 'ወረገኑ ኮንዶሚኒየም', 'Weregenu Condominium', 18, 'በገርጂ መብራት', now(), 3);

  -- 8. መገናኛ - ሾላ / 22 ተራ
  insert into public.stations (id, name_am, name_en, lat, lng, landmark_am, landmark_en, status, last_verified_at)
  values (
    st_shola,
    'መገናኛ ሾላ እና 22 ተራ',
    'Megenagna Shola & 22 Station',
    9.02185, 38.79845,
    'ከሾላ ገበያ ዋና በር ጎን ለጎን',
    'Adjacent to the main gate of Shola Market',
    'active',
    now()
  );

  insert into public.lines (station_id, destination_am, destination_en, fare_birr, direction, fare_checked_at, sort_order) values
    (st_shola, 'ሾላ ገበያ', 'Shola Market', 10, 'በቀጥታ', now(), 1),
    (st_shola, '22 ጎላጉል ታወር', '22 Golagul Tower', 12, 'በ 22 ማዞሪያ', now(), 2),
    (st_shola, 'አትላስ ሆቴል', 'Atlas Hotel', 15, 'በቦሌ መንገድ መታጠፊያ', now(), 3);

  -- 9. መገናኛ - ሜክሲኮ / ጦር ኃይሎች ተራ
  insert into public.stations (id, name_am, name_en, lat, lng, landmark_am, landmark_en, status, last_verified_at)
  values (
    st_mexico,
    'መገናኛ ሜክሲኮ እና ጦር ኃይሎች ተራ',
    'Megenagna Mexico & Tor Hailoch Station',
    9.02080, 38.79975,
    'ከዋናው ድልድይ ስር ወደ መስቀል አደባባይ መስመር መጀመሪያ',
    'Under the main overpass heading west towards Meskel Square',
    'active',
    now()
  );

  insert into public.lines (station_id, destination_am, destination_en, fare_birr, direction, fare_checked_at, sort_order) values
    (st_mexico, 'መስቀል አደባባይ', 'Meskel Square', 15, 'በካዛንቺስ መንገድ', now(), 1),
    (st_mexico, 'ሜክሲኮ አደባባይ', 'Mexico Square', 18, 'በቀጥታ መስመር', now(), 2),
    (st_mexico, 'ጦር ኃይሎች', 'Tor Hailoch', 20, 'በልደታ አድርጎ', now(), 3);

  -- 10. መገናኛ - ፈረንሳይ / ጉለሌ ተራ
  insert into public.stations (id, name_am, name_en, lat, lng, landmark_am, landmark_en, status, last_verified_at)
  values (
    st_ferensay,
    'መገናኛ ፈረንሳይ ተራ',
    'Megenagna Ferensay Station',
    9.02390, 38.80120,
    'ከእንግሊዝ ኤምባሲ መታጠፊያ መንገድ አቅጣጫ',
    'Toward British Embassy junction along the upper ring road',
    'active',
    now()
  );

  insert into public.lines (station_id, destination_am, destination_en, fare_birr, direction, fare_checked_at, sort_order) values
    (st_ferensay, 'ፈረንሳይ ለጋሲዮን', 'Ferensay Legasion', 18, 'በእንግሊዝ ኤምባሲ በኩል', now(), 1),
    (st_ferensay, 'ጉለሌ ፖሊስ ጣቢያ', 'Gulele Police Station', 22, 'በቀበሌ 08 አድርጎ', now(), 2),
    (st_ferensay, 'አምባሳደር / ቴዎድሮስ አደባባይ', 'Ambassador / Tewodros Sq', 18, 'በፒያሳ በኩል', now(), 3);

end $$;
