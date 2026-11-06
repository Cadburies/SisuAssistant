https://youtu.be/TZdKkc8Xju8?si=_apY02oo0EWUhcUL

0:00
If you learned electronics through kits
0:02
and tutorials, well then your prototype
0:05
is probably missing every single
0:07
protection in this video. You've likely
0:09
never run into these problems because
0:11
your prototype is your baby and you
0:13
treat it that way. Unfortunately, your
0:16
customers won't be that gentle. They'll
0:18
plug in whatever adapter fits, zap it
0:21
with static, and cut the power at the
0:23
worst possible moment. There's a big
0:25
jump between a prototype that survives
0:27
you and a product that survives
0:29
thousands of strangers. Two of these
0:32
protections are all that stands between
0:34
your product and an actual fire. And one
0:37
of them is completely free and already
0:39
likely in your design, but almost
0:41
certainly turned off. So, in this video,
0:44
I'm counting down seven protection
0:46
circuits that you should never ship a
0:48
product without. And for every single
0:50
one, I'll tell you exactly what to use
0:52
instead. Hi, I'm John Teal. I spent over
0:55
a decade as a microchip design engineer
0:57
at Texas Instruments. Then I developed
0:59
and launched my own product into
1:01
hundreds of retail stores and now I help
1:03
others do the same. Protection number
1:06
seven that you should always include in
1:08
a product that you ship is reverse
1:10
polarity protection. So, a customer
1:12
plugs in the wrong barrel jack adapter
1:14
or inserts batteries backwards and 1
1:17
second later the board is dead. You'd
1:19
never make that mistake yourself, but
1:21
put a few thousand units into the market
1:23
and someone absolutely will. The typical
1:26
prototype fix is a series diode and it
1:29
works, but it drops.3 to 7 volts across
1:33
the diode, which just wastes power and
1:36
adds heat in a production product. The
1:38
production ready approach is a P channel
1:41
MOSFET wired on the high side of the
1:43
power input. The MOSFET has a built-in
1:46
body diode that conducts under normal
1:48
polarity. And once that diode forward
1:51
biases, then it actually turns on the
1:53
MOSFET. So instead of a diode drop, you
1:56
get almost no voltage drop at all. For
1:59
higher current designs, an ideal diode
2:01
controller does the same job even more
2:04
efficiently. And just to be clear, a
2:06
keyed connector isn't reverse polarity
2:09
protection. Customers defeat mechanical
2:11
safeguards all the time. So total cost
2:14
for this protection is just a few cents.
2:17
Now to make all this easier for you, I
2:19
put together a free production grade
2:21
protection checklist that covers every
2:24
protection in this video. Why products
2:26
die without it and the exact part to
2:28
add. Links in the description below or
2:31
you can scan this QR code here.
2:33
Protection number six to never ship
2:35
without is ESD protection. So, your
2:37
product survives all your testing, then
2:40
dies in a carpeted office in dry winter
2:43
air. Every connector, button, and
2:46
exposed port that a person can touch is
2:48
an entry point for electrostatic
2:51
discharge. USB ports, headphone jacks,
2:54
SD card slots, charging connectors, even
2:56
exposed screw terminals, all of them are
2:59
vulnerable. And a simple carpet to door
3:02
knob shock can hit anywhere from 8 to 15
3:05
kilovolts. This isn't just a reliability
3:08
concern either. It's a certification
3:10
problem. Selling in Europe means passing
3:13
ESD immunity testing under IEC
3:16
requirements. And if your product fails
3:18
at the test lab, that means a board
3:21
respin
3:23
date just slips. You fix this with ESD
3:26
dodes on every externally accessible
3:29
line placed right at the connector with
3:31
a short direct return path to ground.
3:34
These diodes clamp voltage spikes before
3:36
they can reach your sensitive
3:38
components. For USB and other high-speed
3:41
data lines, be sure you use low
3:43
capacitance versions so you don't
3:45
degrade signal integrity. A lot of
3:47
engineers assume that the ESD protection
3:50
that's built into various chips like the
3:52
microcontroller is enough, but those
3:54
internal structures are designed to
3:56
survive the assembly line, not your
3:59
customer's wool sweater in the middle of
4:01
winter. A member of my hardware academy
4:03
had a product working perfectly for a
4:05
year. Then a unit came back with the
4:07
charger IC physically blown. His USB
4:11
shield was grounded, but he had no ESD
4:13
diode on the USB power pin. And one
4:16
static discharge through the port killed
4:19
the charger IC. Each protected line just
4:22
adds a few cents. So this is definitely
4:24
something you don't want to skip.
4:25
Protection number five to never ship
4:27
without is overcurren protection. So, a
4:30
damaged cable, a shorted component, or a
4:33
curious customer poking something where
4:35
they shouldn't, any of these can create
4:37
a short circuit on your board. Without
4:39
overcurren protection, that short
4:41
becomes smoke, melted PCB traces, and a
4:44
safety incident with your company's name
4:47
attached to it. This is where product
4:49
risk turns into legal risk because
4:52
safety standards and major retailers
4:54
expect overcurren protection and fire
4:57
liability has ended. small companies.
5:00
When I was designing power management
5:01
chips at TI, we built current limiting
5:04
into every single chip to protect the
5:06
chip itself. Your board needs that same
5:09
kind of protection at the system level
5:11
because without it, one short takes out
5:14
everything. For most consumer products,
5:16
a resettable PTC fuse is the simplest
5:19
answer and it only cost a few cents. PTC
5:22
stands for positive temperature
5:24
coefficient. And it's basically a
5:26
component that increases its resistance
5:29
sharply when too much current flows
5:31
through it, tripping like a breaker and
5:33
resetting itself once the fault clears
5:36
and it cools back down. But the one
5:38
catch is that PTC's are relatively slow
5:41
compared to active protection, so they
5:43
won't catch very fast transients. If you
5:46
need faster and more precise current
5:48
limiting, an EFuse IC handles that along
5:51
with over voltage lockout in the same
5:54
part, and they typically run about a
5:56
dollar. For safety critical power rails,
5:58
a traditional one-time fuse is your last
6:01
line of defense because it blows
6:04
permanently, which is exactly what you
6:06
want when the alternative is a fire.
6:08
Protection number four to never ship
6:10
without is over voltage and input
6:12
transient protection. So, you ship your
6:14
product with a 5volt adapter, but then
6:17
two years later, the customer grabs a
6:19
12-volt adapter from the junk drawer and
6:21
it fits because the same barrel jack
6:23
connector is used. Everything downstream
6:26
sees more voltage than it can handle.
6:28
And a wrong adapter isn't the only way
6:30
an overvoltage condition occurs. voltage
6:33
spikes from hot plugging cables under
6:35
load, line transients from noisy power
6:38
sources, and load dump surges if your
6:41
product goes anywhere near a vehicle
6:43
electrical system all cause the same
6:45
kind of damage. For short spikes and
6:48
transients, the fix is a TVS diode,
6:51
short for transient voltage suppressor.
6:53
You put one on the power input sized so
6:56
its standoff voltage sits above your
6:59
maximum normal operating voltage, but
7:01
its clamping voltage stays below the
7:04
damage threshold of your downstream
7:06
parts. But a TVS diode can only absorb
7:10
short burst of energy. So it can't
7:12
protect you from a wrong adapter feeding
7:14
your board 12 volts all day long. For
7:16
sustained overvoltage, like a wrong
7:18
adapter, you need an efuse or
7:21
overvoltage protection IC that shuts the
7:23
input off entirely. So, the wrong
7:26
adapter gets ignored instead of killing
7:28
your board. If your product accepts
7:30
power through USBC, keep in mind that
7:33
USB power delivery can negotiate
7:35
voltages up to 48 volts on the same
7:38
cable. Which means a misbehaving charger
7:41
or a bug in your power delivery
7:43
negotiation can push dangerous voltage
7:46
right into a 5volt input rail without
7:49
warning. All of that protection adds
7:52
well under just a dollar. Protection
7:54
number three you need to include is
7:56
inductive kickback protection. Anything
7:58
with a coil in your product fights back
8:01
when you cut the current. Relays,
8:03
motors, and solenoids all store energy
8:05
in a magnetic field while current flows.
8:08
And the moment that you switch that
8:10
current off, the collapsing magnetic
8:12
field fires a high voltage spike
8:15
backwards into your driver circuits and
8:17
microcontroller pins. The sneaky part is
8:20
that this usually survives short bench
8:23
tests just fine. The damage is
8:25
cumulative, so units start failing in
8:28
the field one at a time, weeks or even
8:30
months apart, and it looks like random
8:33
bad luck until you finally figure out
8:35
the pattern. You fix this with a flyback
8:37
diode across every DC relay coil,
8:41
selenoid coil, and simple DC motor to
8:44
give the stored energy a safe path to
8:46
dissipate. Place it as close as possible
8:49
to the coil itself, not back at the
8:52
driver, because the shorter that path
8:54
is, the less chance the spike has to
8:56
cause damage along the way. Protection
8:58
number two that your product needs is
9:00
battery protection. If your product has
9:03
lithium batteries and no dedicated
9:05
protection circuitry, well, then you're
9:07
setting yourself up for a recall.
9:09
Overdischarging a cell drops its voltage
9:12
below the point of safe recovery and
9:14
gradually kills the pack, sometimes
9:17
without any visible sign until the
9:19
battery won't take a charge anymore.
9:21
Overcharging and short circuits cause
9:24
swelling, venting, and fires. You need
9:27
UN 38.3 testing just to legally ship
9:31
lithium batteries, plus additional
9:33
safety certifications depending on your
9:35
market. And most large retailers stack
9:38
their own requirements on top of all of
9:40
that. So, this is the second item in
9:42
this video that can literally burn down
9:45
a customer's house. I always recommend
9:48
starting with protected cells that
9:50
already have the safety circuit built
9:52
in. That gives you over voltage,
9:54
undervoltage, overcurren, and
9:56
shortcircuit protection right at the
9:58
cell. And it reduces your liability. and
10:01
it keeps you safer during development
10:04
when your own charging protection
10:06
circuit might not be fully working yet.
10:08
Then on your board, add a dedicated
10:10
charger IC with correct charge
10:13
termination so aren't charged below
10:16
freezing or above the rated limit. And
10:18
hey, before we get to the only
10:20
protection on this list that cost you
10:23
nothing, don't forget that free
10:25
protection checklist that I mentioned,
10:26
links in the description. Protection
10:28
number one to never ship a product
10:31
without is watchdog and brown out
10:33
protection. So, the first six
10:35
protections on this list protect your
10:37
product against the physical world. This
10:40
one protects it from itself, and I saved
10:42
it for last on purpose because it's the
10:44
only one that's completely free. So,
10:47
your product locks up in a customer's
10:49
home. And then in that case, all they
10:51
can do is file a support ticket or leave
10:54
you a one-star review. The worst case is
10:57
even scarier. The power dips during a
10:59
flash write and your firmware corrupts
11:02
itself permanently and now your product
11:04
is just an expensive paper weight for
11:06
the customer. The fix is already inside
11:09
the microcontroller that you're using
11:11
right now. But most development teams
11:14
disable the watchdog timer during
11:16
debugging and never turn it back on for
11:19
production firmware. Watchdog and
11:21
brownout protection is literally the
11:23
easiest fix on this entire list, but you
11:26
have to set it up correctly. So, enable
11:29
the independent watchdog and feed it
11:31
from your main loop only after critical
11:34
task check out and not from an interrupt
11:37
that fires no matter what. Set the
11:39
brownout detector above the minimum
11:41
voltage required for reliable flash
11:44
rights so the processor resets cleanly
11:46
instead of corrupting firmware during a
11:49
power dip. Now, I know some engineers
11:51
will argue that a watchdog just masks
11:54
bugs, and I get where that comes from,
11:56
but in the field, a product that
11:58
recovers itself beats one that stays
12:00
locked up every single time. Now, if you
12:03
want experienced engineers reviewing
12:05
your circuit protection and the rest of
12:07
your design before it ever ships, that's
12:09
exactly what my team and I do inside my
12:12
hardware academy. And if there's a
12:14
battery anywhere in your product, watch
12:17
this video next because a few battery
12:19
types belong nowhere near a commercial
12:21
product.




In this video, former Texas Instruments design engineer John Teel outlines seven essential protection circuits that developers must include before shipping any electronic product to the public. He emphasizes that prototypes often lack these safeguards, which are necessary to prevent damage from user error, environmental factors, or internal failures.
The seven critical protection circuits:
Reverse Polarity Protection (1:06 - 2:32): Prevents damage if a user plugs in an adapter with the wrong polarity or inserts batteries backward. Teel recommends using a P-channel MOSFET for high-side switching to minimize power loss.
ESD (Electrostatic Discharge) Protection (2:33 - 4:24): Shields sensitive components from static electricity (e.g., from touching ports). The solution is to place ESD diodes on all externally accessible lines.
Overcurrent Protection (4:25 - 6:07): Prevents fires or board damage caused by short circuits. Teel suggests using a resettable PTC fuse for most products, or an eFuse IC for faster, more precise limiting.
Overvoltage and Input Transient Protection (6:08 - 7:52): Protects against sustained overvoltage (like using the wrong power adapter) and voltage spikes. Use a TVS diode for transients and an eFuse or overvoltage protection IC for sustained issues.
Inductive Kickback Protection (7:53 - 8:56): Prevents high-voltage spikes from relays, motors, or solenoids when they are switched off. This is fixed by placing a flyback diode across the coil.
Battery Protection (8:57 - 10:26): Critical for lithium-ion battery safety to prevent overcharging, over-discharging, and short circuits. Teel suggests using pre-protected cells and a dedicated charger IC.
Watchdog and Brown-out Protection (10:27 - 12:25): The only free protection, as it is built into the microcontroller. It prevents the device from locking up and protects firmware from corruption during power dips.



How do eFuses differ from traditional fuses?
Why is watch dog protection considered free?
Where to find the production-grade protection checklist?
7 essential protection circuits?

Former Texas Instruments design engineer John Teel details seven essential protection circuits that are critical for any electronic product before shipping to consumers. These safeguards protect against common user errors and environmental stresses that prototypes often do not face.
The 7 Essential Protection Circuits:

Reverse Polarity Protection (1:06-2:32): Prevents damage from incorrect battery orientation or the wrong power adapter. The recommended approach is using a P-channel MOSFET on the high side to avoid voltage drops and power waste.
ESD (Electrostatic Discharge) Protection (2:33-4:24): Shields sensitive electronics from static shocks (which can reach 8-15 kV) by placing ESD diodes on every external connector, button, and port.
Overcurrent Protection (4:25-6:07): Protects the system from short circuits caused by damaged cables or component failures. A resettable PTC fuse is standard for consumer electronics, while an eFuse IC offers faster, more precise limiting.
Overvoltage and Input Transient Protection (6:08-7:52): Prevents damage from sustained overvoltage (e.g., using a 12V adapter on a 5V device) or voltage spikes. Use a TVS diode for short transients and an eFuse or overvoltage protection IC for sustained issues.
Inductive Kickback Protection (7:53-8:56): Prevents high-voltage spikes caused by collapsing magnetic fields in coils (like motors or relays). The solution is a flyback diode placed as close to the coil as possible.
Battery Protection (8:57-10:26): Critical for lithium-ion safety. Teel advises using pre-protected cells (which include internal safety circuitry) and a dedicated charger IC to prevent overcharging, over-discharging, and fire risks.
Watchdog and Brown-out Protection (10:27-12:25): The only free, software-implemented protection. It uses the microcontroller's internal watchdog timer to reset the device if it locks up and a brown-out detector to prevent firmware corruption during power dips.



Best practices for PCB layout
Simple explanation of these circuits?

Electronic products require these seven protection circuits to survive real-world usage beyond the safe environment of a prototype workbench:
Reverse Polarity Protection (1:06-2:32): Ensures the board doesn't break if a user connects power incorrectly. Using a P-channel MOSFET is the professional way to prevent power waste.
ESD Protection (2:33-4:24): Guards sensitive components against high-voltage static shocks from people touching ports or buttons. ESD diodes act as clamps to safely divert these spikes.
Overcurrent Protection (4:25-6:07): Stops electrical shorts from causing smoke or fires. A resettable PTC fuse is ideal for most products, while eFuse ICs provide faster, more precise limits.
Overvoltage Protection (6:08-7:52): Prevents damage if a user plugs in the wrong high-voltage adapter. TVS diodes handle short spikes, whereas overvoltage ICs block sustained dangerous power levels.
Inductive Kickback Protection (7:53-8:56): Prevents coils (like motors or relays) from firing damaging voltage spikes back into the circuit when turned off. A simple flyback diode provides a safe path for that energy.
Battery Protection (8:57-10:26): Critical for lithium-ion safety. Using pre-protected battery cells and a dedicated charger IC prevents fire, swelling, and permanent cell damage.
Watchdog/Brown-out Protection (10:27-12:25): The only free, software-based protection. A watchdog timer resets the device if it freezes, and a brown-out detector prevents firmware corruption during power dips.



How does a P-channel MOSFET work?
Why are PTC fuses called resettable?
Explain inductive kickback simply.
How to choose the right TVS diode?

Selecting the right TVS (Transient Voltage Suppressor) diode is critical to protecting sensitive electronics. As mentioned in the video (6:47-7:15), the diode must be sized so that it remains inactive during normal operation while clamping voltage spikes before they reach damaging levels.
Key parameters for selection include:
Reverse Standoff Voltage (
𝑉
𝑅
𝑊
𝑀
): This must be higher than your circuit's maximum normal operating voltage (including tolerances and ripple). The goal is to ensure the diode does not conduct or interfere with signals during normal conditions.
Clamping Voltage (
𝑉
𝐶
𝐿
𝐴
𝑀
𝑃
): This is the maximum voltage the diode will allow during a surge. It must be lower than the damage threshold of the most sensitive component in your circuit to provide effective protection.
Unidirectional vs. Bidirectional: Choose based on your signal type. Unidirectional diodes are typically for DC lines, while Bidirectional versions are required for AC signals or data lines where the voltage can swing above and below ground.
Power/Pulse Rating: Ensure the diode can handle the maximum expected pulse current (
𝐼
𝑃
) and energy of the transient event without failing.
Capacitance: For high-speed data lines (like USB), select a low-capacitance TVS diode to avoid degrading signal integrity (3:41-3:45).
How to select a Surge Diode - TI.com

ti.com
 
Types of TVS Diodes & TVS Diode Selection Parameters - Topdiode
topdiodes.com
 TVS Diode: How It Works, Types, Ratings, and Selection - Fly-Wing
flywing-tech.com
 A Practical Guide to TVS Diode Selection and Layout - blog - Onzuu
onzuu.com
 TVS Diodes 101 A Guide To Choose The Right Circuit Protection
farnell.com
 4 Selection guidelines for TVS diodes (ESD protection diodes)
semicon-storage.com
 TVS Diode Selection: Protecting Sensitive Circuits From Voltage ...
fuzetec.com
 Choosing an appropriate TVS – 9 step approach - DigiKey TechForum
digikey.com
 Essential Circuit Protection: Selecting TVS Diodes for Industrial ...
ultralibrarian.com
 How to choose the right TVS diode for ESD protection?
stackexchange.com
 



How does a flyback diode differ?
Explain PTC fuse vs eFuse differences

Choosing between a PTC (Positive Temperature Coefficient) fuse and an eFuse involves balancing cost, complexity, and performance needs for overcurrent protection.
PTC Resettable Fuses (5:16-5:38)

How they work: PTCs are passive components that increase their resistance sharply when too much current flows through them, effectively "tripping" the circuit. Once the fault clears and the device cools down, they reset themselves automatically.
Key advantages: They are extremely low-cost and simple to implement, making them a common choice for basic consumer electronics.
Limitations: They are relatively slow to respond compared to active solutions and may not catch very fast electrical transients. They also have higher internal resistance than a standard fuse.
eFuse ICs (5:46-5:55)

How they work: An eFuse is an active semiconductor device that monitors current in real-time. If a fault is detected, it can instantly limit or disconnect the current.
Key advantages: They offer faster and more precise current limiting than PTCs. They often include additional integrated features, such as overvoltage protection and programmable startup (inrush current control).
Limitations: They are more expensive and complex to design into a circuit compared to a simple PTC fuse.
Comparison Summary

Speed: eFuses provide much faster protection, critical for sensitive downstream components.
Precision: eFuses can be programmed to trip at exact current levels, whereas PTC trip thresholds are less precise and temperature-dependent.
Functionality: eFuses are "active" controllers that can handle multiple protection tasks (like overvoltage lockout) in a single chip.
Cost: PTCs are simple, inexpensive passive components, while eFuses are active ICs carrying a higher price point (typically around one dollar).

What are the advantages of using eFuse ICs over glass fuses and ...

semicon-storage.com
 
eFuse vs. PTC Fuse: Key Differences Explained | RF Wireless World
rfwireless-world.com
 eFuse vs. PTC Fuse: Differences, Performance, and How to Choose
ariat-tech.com
 eeworldonline.com
eeworldonline.com
 



When should I use a one-time fuse?
How does inrush current impact fuse selection?
Are eFuses more reliable than traditional fuses?
Difference between TVS and Zener diodes?

While TVS (Transient Voltage Suppressor) diodes and Zener diodes may appear similar in schematic symbols and construction, they are optimized for fundamentally different roles in electronic circuits.
Core Differences

Primary Function:
TVS Diodes: Designed specifically for circuit protection. They remain inactive during normal operation and only "clamp" high-voltage transient spikes (like electrostatic discharge or lightning-induced surges) to a safe level to protect sensitive components.
Zener Diodes: Primarily used for voltage regulation or as a voltage reference. They are designed to operate continuously in the breakdown region to maintain a stable, constant output voltage for a circuit.
Operating Characteristics:
TVS Diodes: Built to handle high-energy, short-duration pulses. They have a very fast response time and are optimized to dissipate large amounts of power during a surge event.
Zener Diodes: Optimized for continuous operation at specific, stable voltages. They generally have lower pulse-power handling capabilities compared to TVS diodes.
Application Summary:
If you need to safeguard your circuit from sudden, damaging voltage spikes (as discussed in the video regarding input protection at 06:47-07:15), you should use a TVS diode.
If you need to establish a steady voltage reference or regulate a power rail, a Zener diode is the standard choice.

Differences between TVS diode and Zener diodes, in diagrams and ...

stackexchange.com
 
Difference between TVS Diodes and Zener Diodes (1)
semicon-storage.com
 Zener Diode vs TVS Diode: Key Differences Explained - Flywing Tech
flywing-tech.com
 



What are common circuit protection components
Explain how Zener diodes regulate voltage
Where should I place protection diodes?

For optimal protection, the placement of diodes is critical to ensuring they can effectively clamp or divert energy before it reaches sensitive components:
ESD Diodes: These must be placed directly at the connector for every externally accessible line (2:33-4:24). It is essential to ensure a short, direct return path to ground to successfully clamp voltage spikes from sources like static discharge.
Flyback Diodes: These must be placed as close as possible to the coil itself—not back at the driver circuit (7:53-8:56). This proximity ensures the shortest possible path for dissipating the energy generated by the collapsing magnetic field in relays, solenoids, or motors, minimizing the risk of damage along the signal path.
Reverse Polarity Protection: While not a diode in the final recommended design, the P-channel MOSFET used as a modern alternative to a series diode should be placed on the high side of the power input (1:06-2:32).



Why use MOSFETs instead of diodes?
How do flyback diodes function?
What is the best ground path?
How to choose the right TVS diode

Selecting the right TVS (Transient Voltage Suppressor) diode is essential for protecting your circuits from damaging voltage spikes. Based on the video (06:47-07:15) and technical best practices, here are the key parameters to consider when choosing one:
Reverse Standoff Voltage (
𝑉
𝑅
𝑊
𝑀
): This is the most critical parameter. It must be higher than your circuit's maximum normal operating voltage to ensure the diode remains inactive and doesn't interfere during normal operation.
Clamping Voltage (
𝑉
𝐶
𝐿
𝐴
𝑀
𝑃
): This represents the maximum voltage the diode will allow across it during a surge event. It must be lower than the damage threshold of the most sensitive component you are trying to protect.
Unidirectional vs. Bidirectional: Choose unidirectional for DC power lines and bidirectional for AC lines or data lines where signals swing above and below ground.
Capacitance: For high-speed data lines (like USB), prioritize low-capacitance TVS diodes to prevent signal degradation and maintain data integrity.
Power/Pulse Rating: Ensure the diode can safely dissipate the expected energy of the transient event without failing.
Always place these diodes as close to the connector as possible with a direct path to ground for optimal performance.