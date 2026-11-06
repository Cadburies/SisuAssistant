https://youtu.be/Hzm4ajEsNsg?si=dUdClexQCsTLiaiD


0:000 secondsYour power supply feeds every other circuit in your product. So when it goes wrong, well, everything else goes down
0:077 secondswith it. Pick the wrong regulator and a battery that should last a year can be dead in about a week. Ignore peak
0:1414 secondscurrent and your product can reset every time the Wi-Fi turns on. And a sloppy layout around one tiny chip can fail FCC
0:2323 secondstesting even when the schematic is perfect. And a couple of these mistakes can start a fire in a customer's home or
0:3131 secondsgive someone a dangerous shock. Power supplies look like the easiest part of a design, just a regulator and a few
0:3838 secondscapacitors, which is exactly why so many product creators rush through them. So, in this video, I'm counting down nine
0:4646 secondspower supply design rules that you should never break and what each one will cost you if you do. Hi, I'm John Teal. I spent over a decade as a
0:5555 secondsmicrochip design engineer in Texas Instruments power management group and then I developed and launched my own product into hundreds of retail stores
1:041 minute, 4 secondsand now I help others do the same inside my hardware academy. Okay, let's get started. Rule number nine, never
1:111 minute, 11 secondsoverlook inrush current and startup sequencing. Inrush current is just a big spike of current that your product pulls
1:191 minute, 19 secondsthe instant it's plugged in or switched on. Most of that spike comes from charging up the capacitors on your power
1:261 minute, 26 secondsinput. And for a split second, those capacitors almost act like a short circuit. With a lot of capacitance there, that spike can trip the current
1:351 minute, 35 secondslimit on a USB port, make a wall adapter shut down, or cause a spark at the connector every time it gets plugged in.
1:431 minute, 43 secondsUSB is especially picky since the spec limits how much capacitance a device can put right on its power input. The fix is
1:511 minute, 51 secondsto put an inrush limiter or load switch with inrush control, which is a small chip that ramps the voltage up gradually
1:591 minute, 59 secondsin front of those input capacitors. A regulator's soft start feature helps too, but only with the current charging
2:062 minutes, 6 secondseverything after the regulator, not the capacitor sitting right on its input.
2:112 minutes, 11 secondsNow, startup sequencing is the second half of this rule. Since some processors, displays, and other complex chips need their power rails turned on
2:202 minutes, 20 secondsin a specific order. Power them up in the wrong order, and the chip might not boot reliably, or in some cases, it can
2:272 minutes, 27 secondseven be damaged. Regulators with an enable pin and a power good output make this easy since each one can turn on the
2:362 minutes, 36 secondsnext one in line only after its own output is stable. Check the data sheet of every major chip for startup
2:432 minutes, 43 secondsrequirements because finding this after you've built a few hundred units means a board redesign. Now, things like inrush
2:502 minutes, 50 secondscurrent and startup order are really easy to miss because nothing on the schematic looks wrong, and that's true for a lot of the rules in this video.
2:592 minutes, 59 secondsSo, you don't have to remember all nine of these because I put together a free power supply design checklist that covers every rule in this video along
3:083 minutes, 8 secondswith the other power checks I'd look for in a design review. Links in the description below or you can scan this
3:143 minutes, 14 secondsQR code. Rule number eight, never charge a lithium battery without a dedicated
3:213 minutes, 21 secondscharger IC and protection. Lithium batteries pack a lot of energy into a small space and that energy has to be
3:293 minutes, 29 secondscontrolled carefully every time you charge it. A lithium ion or lithium polymer cell needs to be charged with a
3:363 minutes, 36 secondsconstant current first, then held at a constant voltage, usually 4.2 volts, until the current tapers off. Push it
3:453 minutes, 45 secondspast that voltage and the cell can swell, overheat, or catch fire. drain it too low and you can permanently damage
3:523 minutes, 52 secondsit, which makes it more likely to fail the next time it's charged. So, never try to charge a lithium battery with just a resistor, a diode, or a
4:014 minutes, 1 secondtransistor that your firmware turns on and off. Instead, use a dedicated charger IC with a thermister input and
4:094 minutes, 9 secondsconnect it to a thermister, which is just a temperature sensor placed on the battery so charging stops when the cell
4:164 minutes, 16 secondsgets too hot or too cold. Charging below freezing is a big one since it can permanently damage the cell even if it
4:244 minutes, 24 secondsseems fine afterward. On the battery side, you also want a protection circuit that cuts the battery off if it's
4:314 minutes, 31 secondsovercharged, drained too low, or shorted. Most pre-certified battery packs already include that protection
4:384 minutes, 38 secondsboard, which is one more reason to buy an offthe-shelf pack instead of building your own custom. Skip either one and
4:454 minutes, 45 secondsyou're not just risking returns, you're risking a fire in a customer's home.
4:504 minutes, 50 secondsRule number seven, never ignore quiescent current in a battery product.
4:554 minutes, 55 secondsQuiescent current is the small amount of current a regulator draws just to keep itself running even when your product is
5:025 minutes, 2 secondsdoing nothing. In a battery product that spends most of its life asleep, it can be the biggest drain on the battery.
5:095 minutes, 9 secondsTake the AMS 1117 for example, which is a cheap regulator that shows up in a lot of designs because it's on so many
5:175 minutes, 17 secondsdevelopment boards. It can draw around 5 milliamps just sitting there, which would drain a,000 milliamp hour battery
5:245 minutes, 24 secondsin about 8 days, even if everything else in your product was turned off. Low power regulators can draw less than one
5:325 minutes, 32 secondsmicro amp, which turns the regulator into a tiny part of your battery budget instead of the biggest part. Regulators
5:395 minutes, 39 secondsaren't the only culprit, since a voltage divider that measures the battery or an LED left on can draw current around the
5:465 minutes, 46 secondsclock, too. I learned how hard a tiny bit of extra current can be to track down while I was working on a lowqucent
5:545 minutes, 54 secondscurrent regulator design when I was at TI, and I spent weeks hunting down some extra current that the simulation said
6:026 minutes, 2 secondsshouldn't even be there. Well, it turned out to be a parasitic transistor in the physical layout, something nothing in
6:096 minutes, 9 secondsthe schematic could have shown me. So, don't trust your schematic for sleep current and measure it on your prototype with a meter that can read micro amps.
6:186 minutes, 18 secondsRule number six, never skip input protection. Input protection is what keeps your product alive when a customer does something that you didn't plan for.
6:286 minutes, 28 secondsand customers will plug in the wrong adapter, put batteries in backwards, and connect cables while the power is already on. Barrel jacks are a common
6:376 minutes, 37 secondsproblem since a 12-volt adapter often has the exact same plug as a 5V one, and most 5V circuits won't survive that. For
6:466 minutes, 46 secondsreverse polarity, a shocki diode in series with the input works as long as you can afford to lose a few ten of a
6:536 minutes, 53 secondsvolt. If you can't afford that voltage drop, a P channelannel MOSFET wired for reverse polarity protection does the same job with almost no voltage loss.
7:027 minutes, 2 secondsFor the wrong adapter, an overvoltage protection chip can disconnect the input before the high voltage reaches the rest
7:097 minutes, 9 secondsof the circuit. And a TVS diode handles quick voltage spikes. A fuse or a resettable fuse called a PTC sized to
7:187 minutes, 18 secondsprotect your traces and wiring helps make sure that a short circuit turns a into a dead product instead of a melted
7:267 minutes, 26 secondsone. None of these parts cost much, but leaving them out means returns, bad reviews, and units that die the first time someone grabs the wrong adapter.
7:367 minutes, 36 secondsRule number five, never size parts for average current instead of peak current.
7:427 minutes, 42 secondsAverage current tells you how fast your battery drains, but peak current is what decides whether your product actually works. Many products sit at a few
7:507 minutes, 50 secondsmilliamps most of the time, then spike hard for a fraction of a second when a radio transmits, a motor starts up, or a
7:587 minutes, 58 secondsdisplay backlight turns on. The ESP32 is a good example since its Wi-Fi transmissions create short current
8:058 minutes, 5 secondsspikes, and Espressive recommends a power supply that can deliver at least 500 milliamps. If your regulator can't
8:138 minutes, 13 secondskeep up with those spikes, the voltage dips and the microcontroller resets right when it tries to connect to Wi-Fi.
8:208 minutes, 20 secondsIf you're using a switching regulator, the inductor has the same issue since going past its saturation current rating
8:278 minutes, 27 secondsmakes it lose inductance, and with less inductance, the current spikes even higher every time the regulator switches. Batteries have limits, too.
8:368 minutes, 36 secondsAnd a coin cell is the classic trap because it can't deliver much peak current at all. So, its voltage sags
8:448 minutes, 44 secondshard during a radio burst. Add up the peak current of every part on your power rail at the hottest temperature your
8:518 minutes, 51 secondsproduct will see since most chips draw more current as they heat up. Then, pick a regulator that can handle that number with some safety margin. and use the
9:009 minutesregulator's data sheet to size the inductor and figure out how much current it will pull from your battery. Rule
9:079 minutes, 7 secondsnumber four, never ignore the layout of a switching regulator. Switching regulators are efficient because they
9:149 minutes, 14 secondsturn power on and off hundreds of thousands of times per second. But that switching also makes them one of the
9:229 minutes, 22 secondsnoisiest circuits on your board. That's why the layout matters just as much as the schematic. in a perfect schematic
9:299 minutes, 29 secondscan still fail with a sloppy layout. For the most common type, a buck regulator that steps voltage down, the most
9:369 minutes, 36 secondsimportant part is the loop formed by the input capacitor and the regulator. Since fastch changing current flows through it
9:449 minutes, 44 secondsevery time the regulator switches. If that capacitor sits too far away, the loop acts like an antenna and broadcast
9:519 minutes, 51 secondsnoise which can show up as EMI or electromagnetic interference during FCC or CE testing. The switch node, which is
10:0010 minutesthe pin that connects to the inductor, is the other trouble spot. So, keep its copper area small and keep sensitive traces like the feedback line away from
10:0910 minutes, 9 secondsit. Layout noise can also leak into your radio or your sensor readings and make them unreliable. The good news is that
10:1710 minutes, 17 secondsalmost every switching regulator data sheet includes a recommended layout, and the safest move is always to just copy
10:2410 minutes, 24 secondsit as closely as you can. Rule number three, never trust a capacitor's printed value. Ceramic capacitors are in almost
10:3210 minutes, 32 secondsevery power supply, and most product creators assume a 10 microfarad capacitor gives them 10 microfarads. But
10:3910 minutes, 39 secondsthe common ceramic types like X5R and X7R lose capacitance as you put DC voltage across them. And this effect is
10:4810 minutes, 48 secondscalled DC bias. A small 10 microfarad ceramic capacitor rated for 6.3 volts can lose well over half its value at 5
10:5710 minutes, 57 secondsvolts, leaving you with something closer to 4 to 5 microfarads. That's a big problem for regulators because most of
11:0511 minutes, 5 secondsthem need a minimum amount of output capacitance to be stable. Fall below it and an LDO can start to oscillate or a
11:1311 minutes, 13 secondsswitching regulator can produce much more ripple than you expected. Capacitor makers like Marada and TDK publish DC
11:2111 minutes, 21 secondsbias curves for their parts. So check what you'll really get at your operating voltage before you pick one. A larger
11:2811 minutes, 28 secondspackage or a second capacitor can help, but go by the DC bias curve, not just the voltage rating. Rule number two,
11:3711 minutes, 37 secondsnever pick an LDO without checking heat and dropout. An LDO or low dropout regulator is the simplest way to get a
11:4511 minutes, 45 secondslower voltage, but it does it by turning the extra voltage into heat. The heat is just the voltage drop across the LDO times the current flowing through it.
11:5611 minutes, 56 secondsdrop 12 volts down to 3.3 volts at a half an amp. And the LDO has to get rid of about 4.4 watts of power, which is
12:0512 minutes, 5 secondsway more than a small package can handle. Depending on the package and how much copper is around it, a small LDO
12:1212 minutes, 12 secondsmight only handle around one watt or even less before it gets too hot. And when that happens, it either shuts
12:1912 minutes, 19 secondsitself down or cooks the parts all around it. For a big voltage drop or a lot of current, use a switching
12:2612 minutes, 26 secondsregulator instead since it can often be more than 90% efficient. Dropout is the other half of this rule, and it's the
12:3312 minutes, 33 secondsminimum gap the LDO needs between its input and output voltage to keep regulating. Battery products get caught
12:4012 minutes, 40 secondsby this because a lithium battery starts around 4.2 volts when it's full and keeps dropping as it drains. with a 3.3
12:4912 minutes, 49 secondsvolt LDO that needs say around 200 millolts of headroom. Well, the output starts sagging once the battery gets
12:5612 minutes, 56 secondsbelow about 3 and a half volts. And unless your circuits can run on less, you lose a good chunk of the batteries usable capacity. So, if your product
13:0513 minutes, 5 secondsruns from a single lithium cell, look at a buck boost converter, which can make 3.3 volts, whether the battery is above
13:1313 minutes, 13 secondsor below that voltage. Or check whether your chips can run at a lower voltage, like 3 volts. And hey, don't forget that free power supply design checklist I
13:2213 minutes, 22 secondsmentioned since it covers all nine of these rules, plus a lot more in the links in the description. Rule number
13:2913 minutes, 29 secondsone, never design your own AC to DC power supply. Designing your own AC toDC
13:3613 minutes, 36 secondspower supply means your circuit connects directly to wall power and that changes everything about your product. Wall power can kill someone. So the safety
13:4513 minutes, 45 secondsrules are strict and your design will need to pass safety testing to standards like UL. Those standards control how far
13:5213 minutes, 52 secondsapart the high voltage and low voltage parts have to be, what insulation you need, and how the product behaves when a
14:0014 minutespart fails. get any of it wrong and you're not looking at a board redesign.
14:0514 minutes, 5 secondsYou're looking at a product that can shock a customer or start a fire and that leads to recalls and lawsuits. And
14:1214 minutes, 12 secondseven if you get everything right, safety certification for a product that plugs straight into a wall outlet can easily
14:1914 minutes, 19 secondscost $10,000 or more and add months of time to your launch. The better path is a certified external wall adapter. So
14:2814 minutes, 28 secondsthe only thing your product ever sees is a safe low voltage. That makes your own safety testing much simpler and cheaper.
14:3614 minutes, 36 secondsJust make sure that the adapter that you pick also meets the efficiency rules for wall adapters in every country where
14:4414 minutes, 44 secondsyou'll be selling. If the power supply has to be inside your product, use a pre-certified AC to DC module instead of
14:5214 minutes, 52 secondsdesigning one from scratch. Though, your wiring spacing and enclosure around it will still need a safety review. Wall
15:0015 minutespower adds a shock risk that can kill on top of the fire risk, and that's why this rule sits at number one. If you'd
15:0715 minutes, 7 secondslike an expert to look over your power supply design before you order boards, whether that's your regulator layout or your battery charging circuit, you can
15:1615 minutes, 16 secondsget help from me and other experienced engineers inside my hardware academy.
15:2015 minutes, 20 secondsAnd if you found this video helpful, then watch my video on the nine schematic rules that you should never break next since a lot of power supply mistakes start right on the schematic.


