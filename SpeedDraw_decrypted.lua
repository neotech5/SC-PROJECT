--[[
============================================================================
  SpeedDraw.lua - DECRYPTED / DEOBFUSCATED VERSION
============================================================================
  Hasil reverse engineering fail SpeedDraw.lua (yang di-obfuscate dengan
  custom Lua-VM obfuscator, gaya Prometheus).

  KAEDAH: bytecode VM di-deserialize + dijalankan dalam sandbox lua5.1,
  semua string constant yang di-XOR-encrypt berjaya di-dekod.

  PENEMUAN: SpeedDraw.lua sebenarnya HANYA sebuah LOADER. Ia tidak
  mengandungi logik game — logik sebenar di-hos di server (rubis.app) dan
  dilindungi lagi oleh obfuscator kedua "Goofyscator" (goofyscator.lua.cz)
  dengan anti-tamper berbilang peringkat.

  Di bawah ialah kod yang setara dengan apa yang SpeedDraw.lua lakukan
  bila dijalankan (bukan bytecode, tapi tingkah laku sebenar yang dipulihkan):
============================================================================
]]

-- 1) Semakan anti-tamper / anti-emulator.
--    Guna API MarkerCurve untuk sahkan ini engine Roblox sebenar.
--    Jika tingkah laku tidak sepadan -> abort (elak dijalankan di emulator).
local markerCurve = Instance.new("MarkerCurve")
markerCurve:InsertMarkerAtTime(0.25, "startEvent")
markerCurve:InsertMarkerAtTime(0.75, "endEvent")
local markers = markerCurve:GetMarkers()   -- sahkan tingkah laku engine
markerCurve:Destroy()
-- (kod asal membandingkan 'markers' dengan nilai jangkaan; jika gagal ia berhenti)

-- 2) Ambil script sebenar dari server, kemudian jalankan.
local SCRIPT_URL = "https://api.rubis.app/v2/scrap/eK9y5PkiCUFB3psW/raw"
local source = game:HttpGet(SCRIPT_URL)
loadstring(source)()

--[[
============================================================================
  NOTA PENTING TENTANG LAPISAN KEDUA (payload dari rubis.app)
============================================================================
  Payload di SCRIPT_URL (~148 KB) di-obfuscate dengan "Goofyscator".
  Analisis sandbox menunjukkan ia mempunyai anti-tamper berbilang peringkat:

    Peringkat 1  : semak environment/metatable (BERJAYA saya pintas)
    Peringkat 2  : "Goofantitamper" — self-check berdasarkan fingerprint
                   runtime Roblox sebenar (guna task.defer + TextChatService).
                   Ini TIDAK boleh dipenuhi di luar Roblox client sebenar.

  Bila tamper dikesan, Goofyscator menjalankan rutin RETALIASI untuk
  crash/freeze executor:
      vector.create(17468, 1, 1)
      Vector2int16.new(6767676, 6767676)   -- nilai besar untuk crash
      GUF_CRASH()

  Oleh itu logik SpeedDraw sebenar TIDAK boleh di-decrypt secara statik/offline.
  Untuk decrypt penuh, perlu jalankan dalam Roblox client sebenar + hook VM
  di runtime (dump constants selepas anti-tamper lulus) — sama seperti
  situasi Luraph pada Zombie.lua.
============================================================================
]]
