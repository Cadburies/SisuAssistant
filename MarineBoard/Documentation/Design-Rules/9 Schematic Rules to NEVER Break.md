0:00
The schematic mistakes in this video are
0:02
small enough that most people never
0:04
notice them until the boards come back.
0:07
Break these rules and you can get units
0:09
that die in customers hands, boards
0:12
where the chips can't even talk to each
0:14
other, or a batch where some of the
0:16
units never even boot. Fixing a mistake
0:19
on the schematic before prototyping cost
0:22
you nothing. But afterward, it cost a
0:24
board spin, a new build, and about a
0:26
month of your time. These are the nine
0:29
schematic rules that I see broken most
0:31
often in the designs that come through
0:33
my design reviews. So, let me walk you
0:35
through all of them and I'll tell you
0:37
how to fix every one of them. Hi, I'm
0:40
John Teal. I spent over a decade
0:42
designing microchips at Texas
0:43
Instruments before developing and
0:45
launching my own product into hundreds
0:47
of retail stores. And now I help others
0:49
do the same inside my hardware academy.
0:52
Okay, let's get started. Rule number
0:54
nine, never skip ESD protection on
0:57
external connections. A product that
0:59
works perfectly on your bench can start
1:01
coming back dead once it's in customers
1:03
hands and they start plugging in cables.
1:06
The cause is usually static electricity
1:09
or ESD and a person can carry thousands
1:12
of volts without ever feeling a zap.
1:15
Every chip does have some ESD protection
1:17
built into its pins, but that protection
1:20
is really only meant to get it through
1:22
handling and assembly at the factory.
1:24
It's not built to survive a customer who
1:26
walks across the carpet on a dry day and
1:29
touches your USB port. If you're selling
1:32
in Europe, the CE lab will even zap your
1:35
product with thousands of volts on
1:37
purpose to make sure that it survives.
1:39
So any signal that runs to a connector
1:42
or to exposed metal that a person can
1:44
touch needs an ESD protection diode
1:47
placed right where that signal enters
1:49
the board. Now for fast signals like USB
1:52
data lines pick a low capacitance part
1:54
so the protection doesn't mess up the
1:56
signal itself. Power inputs need a TVS
1:59
diode which just stands for transient
2:01
voltage suppressor and it clamps voltage
2:04
spikes before they can reach the rest of
2:06
your circuit. These spikes happen more
2:08
often than you'd probably think because
2:10
just plugging in a power adapter can
2:12
make the input voltage overshoot for an
2:15
instant, sometimes almost double its
2:17
normal voltage level. Pick a TBS diode
2:20
that stays off at your normal input
2:22
voltage, but clamps below the maximum
2:24
voltage that your regulator can handle.
2:27
These dodes cost just a few cents each,
2:30
which is nothing compared to what a
2:32
batch of returns will cost you. Now, you
2:34
don't need to remember all nine of these
2:36
because I put together a free design
2:38
review checklist that you can run your
2:40
own design through before you order
2:42
boards. It's actually a cut down version
2:45
of the same checklist that my engineers
2:47
use on our design reviews. And every
2:50
mistake in this video is in it along
2:52
with dozens more checks for your
2:54
schematic PCB layout and enclosure. The
2:57
links in the description below or you
2:59
can scan this QR code. Rule number
3:02
eight, never drive a load straight from
3:05
an MCU pin. A typical microcontroller
3:08
pin can only source or sync somewhere
3:10
maybe around 8 to 20 milliamps of
3:12
current. That means one bright LED is
3:15
already near the limit and a relay coil
3:18
or a motor is way past it. Hook a relay
3:22
coil directly to a microcontroller pin
3:24
and either the relay just never closes
3:27
or it does and the pin's output driver
3:30
burns out. Motors and relays add a
3:33
second problem because when the current
3:35
through a coil stops, the coil kicks a
3:38
voltage spike back onto whatever was
3:40
driving it. A microcontroller pin simply
3:43
won't survive that. So, put a switch
3:45
between the chip and the load like a BJT
3:48
or a MOSFET for simple DC loads or a
3:51
driver IC for LED strings or stepper
3:54
motors. Then give every coil a flyback
3:57
path, which is just usually a diode
4:00
across it. Rule number seven, never
4:02
leave boot or strapping pins undefined.
4:05
A batch of boards where most units boot
4:08
fine and a few sit there dead in
4:10
bootloadader mode is almost always a
4:12
strapping pin problem. Many
4:14
microcontrollers and wireless chips
4:16
check a few pins called strapping pins
4:19
right as they come out of a reset. The
4:21
levels on those pins decide whether the
4:23
chip runs your firmware or sits waiting
4:26
in bootloadader mode. For instance, the
4:28
ESP32 is a classic example with GPIO0
4:32
and GPIO2 deciding the boot mode. It
4:35
also has a pin called MTDI that sets the
4:38
supply voltage for its flash memory. On
4:41
the STM32, a pin called boot zero
4:44
decides the boot mode. The levels on
4:46
these pins have to hold steady through a
4:48
short reset window that's spelled out in
4:50
the data sheet. On the ESP32, those pins
4:53
only have a weak internal pullup or pull
4:56
down resistor. That means the usual
4:58
failure is something else sharing the
5:00
pin and overpowering those weak resistor
5:03
pullups during the reset window. A
5:06
common example is an SD card line on the
5:10
MTDI pin since SD cards need a pullup on
5:13
that line. And on a chip with no
5:16
internal pullup or pull down resistor at
5:18
all, a floating strap pin can read high
5:21
on one board and low on the next board.
5:24
The fix is to pull every strapping pin
5:26
to its correct level with a resistor.
5:29
And if a pin does double duty, make sure
5:31
nothing else connected to it can
5:33
overpower that resistor during the reset
5:35
window. Rule number six, never ship a
5:38
schematic without test points. Testing a
5:42
prototype on your bench is easy when you
5:44
can probe right on the pins of any chip.
5:46
But leadless packages like QFN and BGA
5:49
put their pins under the chip or flush
5:52
with its body where a probe can't get to
5:55
them. So even for your own testing
5:57
before production, you need test pads on
6:00
the signals that you'll want to measure.
6:01
A factory has the same problem even
6:03
worse because it tests boards using
6:06
something called a bed of nails fixture.
6:09
That's just a jig with rows of
6:11
spring-loaded pogo pins that press onto
6:14
the board while software runs a test on
6:16
every unit. Those pins need pads to land
6:19
on. If you didn't put test pads in your
6:22
design, the factory either test a lot
6:24
less than you probably think or
6:26
somebody's probing every board by hand.
6:29
Add test points on the power rails and
6:31
on any signals that you need for
6:33
debugging and production testing. Just
6:35
be sure to keep them off of crystal pins
6:38
and off of high-speed lines like USB
6:40
because the extra capacitance from the
6:42
pad itself can hurt those signals. Draw
6:45
these into the schematic now since
6:47
adding them after layout means moving
6:49
parts that were already placed. Rule
6:52
number five, never skip I2C pull-ups or
6:56
stack them. If your I2C bus randomly
6:59
drops bits, it can look exactly like a
7:01
firmware bug, but a lot of the time it's
7:04
really a pull-up resistor problem. I2C
7:07
is an open drain bus, which means that
7:09
every chip on it can only pull the lines
7:12
down. The only thing that pulls them
7:14
back up is the resistors that you add.
7:17
Leave those resistors off and the bus is
7:19
either dead or it limps along on the
7:22
microcontroller's weak internal
7:23
pull-ups. That's why nobody notices
7:26
until you add a longer cable or a second
7:28
module to the bus. Every chip and every
7:31
inch of cable adds capacitance to the
7:34
bus. And a weak pullup charges that
7:37
capacitance back up slowly. That means
7:39
the line rises too slowly to reach a
7:42
clean high before the next clock pulse,
7:44
which limits how fast your bus can run.
7:47
The opposite mistake bites you the
7:49
moment you start building with modules.
7:51
Most sensor breakout boards ship with
7:54
their own pull-ups already installed.
7:56
Put four of those modules on one bus and
7:59
you've got four sets of resistors in
8:00
parallel, which turns a 4.7K ohm
8:04
resistance into only about 1.2K. On a
8:07
3.3 volt bus, that's close to the
8:09
maximum current that the I2C spec
8:12
guarantees a chip can pull down. And on
8:14
a 5V bus, it's already over it. A chip
8:17
with a weaker pull down device then
8:20
struggles to pull the line low enough
8:22
and that's where the dropped bits come
8:24
from. So pick one place for the pullups
8:27
and remove them from any modules that
8:29
you add. The bus speed and the total
8:32
capacitance limit the highest value that
8:34
you can use while the bus voltage and
8:37
the chip with the weakest pull down
8:39
limit the lowest value. Rule number
8:41
four, never assign a GPIO without
8:45
checking what it can do. A pin labeled
8:47
GPIO can still have a list of exceptions
8:50
buried in the data sheet table. And on
8:52
most chips, this is the case. The ESP32
8:55
has several pins that are input only
8:58
with no output driver and no internal
9:01
pull up or pull down resistors. Route an
9:03
LED or a chip select to one of those
9:06
pins and it just never moves. Analog is
9:09
the other trap because a chip might
9:11
advertise a dozen ADC channels but only
9:14
bring them out on certain pins. On the
9:17
ESP32, for example, a whole bank of
9:19
those channels stops working the moment
9:21
that you turn on Wi-Fi. Before you wire
9:24
anything up, refer to the pin function
9:26
table in the data sheet. Then check
9:29
every signal against it, whether it
9:31
needs output drive, analog, PWM, or the
9:35
ability to wake the chip from sleep.
9:37
Rule number three, never skip level
9:40
shifting between voltage domains. Plenty
9:43
of products end up with two voltage
9:44
levels on one board, like a 5volt
9:47
microcontroller talking to a 3.3 volt
9:49
sensor or the other way around. The
9:51
mistake is wiring those signals straight
9:54
across. When a 5volt output drives a 3.3
9:57
volt input, well, then current can flow
10:00
through the protection diode that's
10:02
inside the chip and backwards into its
10:04
3.3 volt rail. That pin might work for
10:07
months before it fails or it can lock up
10:09
the whole chip. Now going the other way,
10:11
a 3.3 volt output driving a 5volt input
10:14
is a bit of a sneakier problem. A 5V
10:17
coals input often needs at least 3 and
10:21
1/2 volts to be guaranteed to see a
10:23
logic high. Well, a 3.3 volt signal
10:26
falls short of that, which means it gets
10:28
read correctly on some units and not on
10:31
other units. That's the worst kind of
10:33
failure because it passes on every
10:35
prototype that you look at, but then it
10:37
shows up on customer returns. Now, some
10:39
pins are marked 5vt tolerant in the data
10:42
sheet, but check the fine print on that.
10:44
On some chips, that tolerance goes away
10:47
when the pin is used for analog or when
10:49
the chip is powered off. Level shifting
10:52
doesn't always mean that you need a
10:53
dedicated translator chip. For a slow
10:56
signal going one direction, so from a
10:58
higher voltage down to a lower voltage,
11:01
a simple voltage divider just made of
11:03
two resistors will work. Going up in
11:06
voltage, a small MOSFET and a pull-up
11:08
resistor to the higher voltage does the
11:10
job. For anything faster, use a buffer
11:13
or a level translator IC that's rated
11:15
for it. Rule number two, never place a
11:18
crystal without load caps sized
11:21
correctly to its spec. So, a wireless
11:24
product that fails at the certification
11:26
lab or a USB product that never shows up
11:30
on the computer can both trace back to
11:33
two tiny capacitors next to the crystal.
11:36
A crystal's data sheet gives you a load
11:38
capacitance, something like 12 poparads
11:40
or 18 poparads, but that's the total
11:43
capacitance the crystal needs to see to
11:45
run at the correct frequency. Now the
11:48
common mistake is putting two 18 poparad
11:50
caps on an 18 poparad crystal. Just
11:53
remember from the crystal's point of
11:55
view those two caps are in series which
11:57
cuts their value in half. The right way
12:00
is to subtract the stray capacitance
12:02
from the chip pins and traces then
12:04
double what's left. So for an 18 poparad
12:08
crystal that usually lands you closer to
12:10
30 poparads for each capacitor. The
12:12
crystal still runs with the wrong caps,
12:14
just a little off the correct frequency.
12:17
And that's fine for a blinking LED, but
12:20
for a radio where it builds its channel
12:22
frequency from that crystal, its
12:24
transmit frequency can land outside the
12:27
limit and the certification lab fails
12:29
you. USB can fail, too, because if the
12:32
caps are way too big, well, the
12:34
amplifier inside that the chip that
12:36
drives the crystal may not have enough
12:38
gain to get it going. So, the oscillator
12:41
starts late or maybe not at all. Without
12:44
a stable clock, the USB connection just
12:46
never gets set up correctly. Use the
12:48
formula from the crystal data sheet. And
12:51
if the chipmaker doesn't give you a
12:52
straight capacitance number, assume a
12:55
few poparads. Then, measure the
12:57
frequency on your first prototype to be
12:59
sure it's accurate. And hey, before we
13:01
get to number one, don't forget to grab
13:03
that free design review checklist I
13:05
mentioned. The links in the description.
13:07
Rule number one, never leave a MOSFET
13:10
gate or driver input floating during
13:13
reset. Now, I say this one last on
13:15
purpose because every other rule on this
13:17
list can break your product, but this
13:19
one can actually hurt somebody. When
13:22
power first comes up, most
13:23
microcontroller pins start out as high
13:25
impedance inputs, which means they
13:27
aren't driving anything. They stay that
13:30
way until the firmware sets them up,
13:32
which can take a few milliseconds or a
13:34
lot longer on chips with a slow boot
13:36
time. The same thing happens every time
13:39
the chip resets. If that pin is the only
13:41
thing holding a MOSFET gate off, the
13:44
gate is now floating. It drifts to
13:46
whatever voltage leakage current and
13:49
nearby noise push it to. That can be
13:51
enough to turn the MOSFET partially on.
13:54
A MOSFET is often what switches power to
13:56
a device outside the board. And if
13:58
that's something like a motor, a heater,
14:01
or a pump, well then it can be running
14:03
before a single line of your code is
14:05
run. So every gate and every driver
14:08
enable pin gets a resistor that holds it
14:10
off, usually around a 10k ohm. That's a
14:13
pull down for a low side in channel
14:15
MOSFET or a pull up to the source for a
14:18
high-side P channel FET. If you're using
14:21
a gate driver IC, put the same resistor
14:23
on its input and check the reset state
14:26
of the exact pin that you picked since
14:28
some pins turn on internal pullup during
14:31
startup and some even output a signal
14:34
while the chip boots. In those cases,
14:36
you can't count on a pull down resistor
14:39
on the FET gate to keep it from turning
14:41
on during reset. If you'd like a second
14:43
set of eyes on your schematic before it
14:45
goes out for boards, that's exactly what
14:47
you get inside my hardware academy. We
14:50
review your design using the full
14:52
version of the design review checklist
14:53
that I mentioned. And we catch things
14:55
that not only make your product
14:57
non-functional, but also make it fail
14:59
certification, hurt its reliability, or
15:02
keep it from being manufactured
15:04
repeatably in volume. And since the
15:06
schematic is only half of the job, this
15:09
video right here on the 11 PCB layout
15:12
rules that you should never break is the
15:15
video I suggest you watch next.


List the 9 schematic rules

The nine schematic design rules provided in the video are as follows:
Never skip ESD protection on external connections: Use ESD diodes for external signals and TVS diodes for power inputs to protect against static electricity (0:54).
Never drive a load straight from an MCU pin: Use a switch like a MOSFET or BJT and include a flyback diode for inductive loads to prevent damage (3:02).
Never leave boot or strapping pins undefined: Ensure these pins are pulled to their correct state with a resistor to avoid boot failures (4:02).
Never ship a schematic without test points: Include test pads on power rails and key signals to facilitate production testing and debugging (5:38).
Never skip I2C pull-ups or stack them: Use a single set of pull-up resistors sized correctly for your bus speed and capacitance, and remove them from modules (6:52).
Never assign a GPIO without checking its function: Verify pin capabilities in the datasheet to ensure the chosen pin supports required functions like ADC, PWM, or output drive (8:41).
Never skip level shifting between voltage domains: Use voltage dividers, MOSFETs, or level translator ICs when interfacing between different voltage levels (9:37).
Never place a crystal without load caps sized correctly: Calculate the load capacitance based on the crystal's specification, accounting for stray capacitance, to ensure stable clock operation (11:18).
Never leave a MOSFET gate or driver input floating during reset: Use a pull-down or pull-up resistor to hold the gate off while the microcontroller initializes (13:09).



How to calculate crystal load capacitance?
What defines a robust test point strategy?
Explain flyback diode purpose for relays.

A flyback diode is essential when driving inductive loads like relays because it protects your circuit from damaging voltage spikes (3:33).
When current flowing through a relay coil is suddenly interrupted, the magnetic field within the coil collapses. According to Lenz's Law, this generates a significant, brief voltage spike (often called back-EMF) that can be several times higher than the supply voltage. If this spike is not properly managed, it can destroy the output driver of a microcontroller or other switching components.
The diode is placed in parallel with the relay coil (3:57). During normal operation, the diode is reverse-biased and does not conduct. However, when the coil is turned off, the diode provides a safe, recirculating path for the collapsing magnetic energy to dissipate, clamping the voltage to a safe level and preventing it from damaging the rest of the board.