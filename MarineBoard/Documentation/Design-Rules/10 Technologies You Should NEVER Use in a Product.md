https://youtu.be/5aSHGyfdruM?si=aPcH8prIZpVuaLKu

0:00
When you're developing a new electronic
0:02
product, it's so easy to get pulled
0:04
toward the latest and most advanced
0:06
technologies. But the truth is, many of
0:08
these choices will make your product
0:09
nearly impossible to develop, at least
0:12
without a huge team, a massive budget,
0:14
and years of extra time. So, in this
0:17
video, I'm going to show you 10
0:18
technologies that you should avoid
0:20
whenever possible, because they can trap
0:23
you in endless development and prevent
0:25
your product from ever reaching the
0:27
market. Hi, I'm John Teal. I'm a former
0:29
microchip design engineer who brought my
0:31
own product to market and now I help
0:33
others develop and launch their
0:35
electronic products inside my hardware
0:37
academy. All right, let's get started.
0:39
Technology number 10 is high-end
0:41
application processors such as those
0:43
from Qualcomm and Broadcom. Now, these
0:46
chips look incredible on their spec
0:48
sheets, and they're what power most
0:50
flagship smartphones and tablets,
0:53
offering insane performance, beautiful
0:55
graphics, and every type of connectivity
0:57
that you can imagine. But here's the
0:59
reality. They're basically off limits to
1:03
startups and small teams. The data
1:05
sheets are locked behind non-disclosure
1:08
agreements, and you usually won't even
1:10
get proper reference designs. And unless
1:13
you're a huge customer, you're not
1:15
getting any meaningful support. Minimum
1:18
order quantities can be tens of
1:20
thousands of units, and integrating the
1:23
software stack is a massive job, even
1:25
for experienced teams. I've seen
1:27
entrepreneurs waste months just trying
1:29
to get basic documentation or battling
1:32
buggy drivers that were never meant for
1:34
the general public. A better move is to
1:36
stick with accessible platforms that
1:38
actually support small teams.
1:40
Microcontrollers like the STM32 or ESP32
1:45
give you plenty of power and are easy to
1:47
get up and running. If you need more
1:49
performance, something like a Raspberry
1:51
Pi compute module gives you more
1:54
horsepower, but still with real
1:56
documentation, community support, and
1:58
reference designs that you can actually
2:00
use. And just to add, the same goes for
2:04
dedicated AI and machine learning chips.
2:07
These sound of course exciting, but they
2:09
often come with really high complexity
2:11
and limited software support. If you're
2:14
developing a new product right now and
2:16
want to avoid design mistakes that make
2:18
any technology a nightmare to implement,
2:20
then grab my free design review
2:22
checklist bundle. You'll get separate
2:24
design review checklist for your
2:25
schematic, your PCB layout, and the
2:28
enclosure design. The three areas where
2:30
most product failures start. The links
2:32
in the description or just scan this QR
2:35
code. Tech number nine is custom RF
2:38
designs, especially sub gigahertz. So
2:41
trying to do your own custom RF design,
2:44
especially in the sub gigahertz range,
2:46
is going to be a huge gamble. At higher
2:48
frequencies like 2.4 GHz, you can at
2:51
least find pre-certified modules for
2:53
Wi-Fi, Bluetooth, and ZigG. But once you
2:56
drop into 433 MHz or 900 MHz territory,
3:01
well then you're usually on your own.
3:03
That means designing antennas from
3:06
scratch, tuning matching networks, and
3:08
trying to pass FCC or CE testing without
3:12
much vendor support. And RF is tricky.
3:15
Your layout, your enclosure, even the
3:18
battery wire running too close to the
3:20
antenna, all of it can break your
3:22
wireless performance. Unless you have
3:24
serious RF expertise and test equipment,
3:27
you're better off using pre-certified
3:30
wireless modules or sticking to wireless
3:32
technologies that come with proven
3:34
reference designs and antenna solutions
3:37
that you can actually use. Technology
3:39
number eight that you want to avoid is
3:42
needing to design a custom battery pack.
3:44
One of the most common reasons people
3:46
choose a custom battery is because
3:48
they're trying to squeeze in every last
3:51
bit of battery capacity. If you're
3:53
building something small like a wearable
3:55
or a handheld device, it's really
3:57
tempting to design a battery that
4:00
perfectly fits the internal shape to
4:02
maximize energy density. But going
4:04
custom introduces a whole new layer of
4:07
risk. The moment you design a custom
4:10
battery pack, you're responsible for
4:12
meeting strict safety and transportation
4:14
standards. The testing process is
4:16
expensive, timeconsuming, and
4:19
failureprone, especially for small teams
4:22
without dedicated compliance engineers.
4:24
On top of that, you'll face delays if
4:27
your certification lab finds anything
4:29
questionable. And you'll have to source
4:31
specialized suppliers who can build
4:33
packs at low volumes while still
4:35
supporting traceability and quality
4:37
control. A far safer and faster approach
4:40
is to stick with off-the-shelf batteries
4:43
such as pre-certified lithium polymer
4:45
packs. You won't be able to use 100% of
4:48
the available internal volume for your
4:50
product, but you'll avoid a year-long
4:53
certification slog and a major liability
4:56
risk if something goes wrong. Tech
4:58
number seven to avoid is advanced USB
5:01
features. Advanced USB features like USB
5:04
3.0 You know, super speed or USB power
5:07
delivery sound fantastic on paper. You
5:10
get higher data rates, more flexible
5:12
power delivery, and modern
5:14
compatibility, but both of these
5:16
features come with some serious
5:17
implementation challenges. USB 3.0 runs
5:21
at 5 GHz per second or more. To get that
5:25
working reliably, you need carefully
5:27
matched differential pairs, very tight
5:30
impedance control, and a multi-layer PCB
5:33
stackup that supports high-speed
5:35
routing. And debugging issues is no
5:37
small feat either. You'll need expensive
5:40
tools like high bandwidth oscilloscopes
5:42
and signal integrity test setups, tools
5:45
that most small teams don't have access
5:47
to or that can't afford. USB power
5:50
delivery is another beast. It lets your
5:52
device negotiate power profiles up to 20
5:55
volts and 5 amps, which sounds great if
5:58
your product needs that kind of power,
6:00
but it also means adding a dedicated
6:03
power delivery controller chip firmware
6:06
to manage voltage negotiation and
6:08
precise power switching. Unless your
6:11
product truly needs high-speed data, or
6:13
more than 5 volts from USB, you're
6:16
better off keeping things simple. USB
6:19
2.0 O for data, it still gives you 400
6:22
megabits per second. And for power,
6:25
stick with just a 5volt USB charging or
6:28
a DC barrel jack. USB power delivery is
6:31
great when you need it, but you
6:32
definitely need to know what you're
6:33
signing up for. Tech number six is
6:36
wireless charging. Wireless charging
6:39
feels futuristic, and for marketing, it
6:42
really sounds great. Just drop your
6:44
device on a pad and it charges. But
6:46
under the hood, it's a different story.
6:48
Coil alignment has to be perfect.
6:51
Thermal issues come up fast and
6:53
efficiency is much lower than wired
6:55
charging. And if the power transfer is
6:57
inconsistent, customers start
6:59
complaining. On top of that, chi
7:02
certification isn't cheap. And that is
7:04
the standard for most wireless charging.
7:07
And inductive charging introduces a
7:09
whole new mess of EMI issues that are
7:11
hard to troubleshoot. Unless wireless
7:13
charging is a must-have feature for your
7:16
product, then you're going to get better
7:17
results. just using a USBC port, pogo
7:20
pins, or even a a custom cradle. These
7:23
options still feel sleek, but they're
7:26
far easier to implement and much more
7:28
reliable. Tech number five, proprietary
7:31
or high-speed connectors. So, it's easy
7:34
to be tempted by sleek modern connectors
7:37
like MIP, Thunderbolt, or even Apple's
7:40
Lightning connector. They look clean and
7:42
offer blazing fast data rates on paper,
7:45
but integrating these can be brutal.
7:48
You'll often need expensive test
7:49
fixtures, detailed timing analysis, and
7:53
access to documents you can't get unless
7:56
you're a high volume partner. With
7:57
Apple's Lightning Connector, you're also
8:00
dealing with licensing fees and per unit
8:02
royalties through their MFI program.
8:05
Unless you're shipping millions of
8:06
units, you won't have the support or the
8:09
leverage to use these interfaces safely.
8:11
Stick with more accessible standards
8:13
like SPI, I2C, LBDS, or HDMI. They're
8:18
not maybe as flashy, but they're far
8:20
more forgiving, and they won't block you
8:22
from getting to production. Tech number
8:24
four to avoid are overly fancy displays.
8:27
An active matrix OLED screen like the
8:30
kind used in smartphones and tablets can
8:33
make your product look really cool and
8:35
modern. But despite how amazing they
8:38
look, these displays are usually a bad
8:41
choice for small teams. They often
8:43
require a MIPY DSi interface, which
8:46
isn't supported by most
8:47
microcontrollers. That means you'll be
8:49
locked into using a more expensive
8:51
application processor, even if the rest
8:54
of your product doesn't need that kind
8:56
of power. The cost of these displays
8:58
themselves are also high. They're
9:00
typically priced for largecale phone
9:02
manufacturers, not low volume hardware
9:04
startups. Even worse, these panels have
9:07
short lifespans in the supply chain. A
9:10
model might be discontinued without
9:12
warning or replaced by a new revision
9:14
that isn't compatible with your existing
9:16
design. Even when you get documentation,
9:19
integrating them takes time. managing
9:21
the initialization sequences, voltages,
9:24
backlight control, and timing. For most
9:27
projects, you're much better off with a
9:29
standard TFT, LCD from a supplier like
9:32
New Haven or by display.com. Stick to
9:35
common resolutions and simpler
9:37
interfaces like SPI or Parallel RGB.
9:41
You'll avoid being locked into an
9:42
expensive processor, and you'll have a
9:44
much smoother path to production. Tech
9:47
number three, high-end analog audio.
9:50
Audio seems simple. It's just sound,
9:52
right? But high-end analog audio is one
9:55
of the most unforgiving parts of
9:56
electronics design. Your layout matters.
9:59
Grounding matters. Shielding matters.
10:01
Power supply noise matters. Even tiny
10:04
mistakes create hiss, hum, or distortion
10:07
that customers will definitely hear. And
10:09
validating these designs requires test
10:11
equipment that most small companies
10:13
don't have access to. If you don't have
10:16
serious analog expertise on your team,
10:18
don't try to go toe-to-toe with audio
10:21
filegrade products. Instead, use digital
10:24
audio interfaces like USB, I2S, or
10:27
Bluetooth modules where the hard stuff
10:29
is handled for you already. And if you
10:32
need analog, start with something small
10:34
and copy the reference design exactly.
10:37
Technology number two, 5G or cuttingedge
10:41
cellular modules. 5G sounds like the
10:43
future and for some applications it's
10:45
really beneficial. But for most
10:47
startups, you don't need it and trying
10:50
to integrate it usually ends up being a
10:52
huge drain on your resources. These
10:54
modules are expensive. They often
10:56
require specialized SIM provisioning,
10:58
thermal design considerations, and
11:00
compliance testing with cellular
11:02
carriers. And just because a module is
11:04
pre-certified doesn't mean your end
11:06
product will sell through
11:07
certifications. If your antenna tuning,
11:10
ground plane, or enclosure affects
11:12
performance, you could be forced to go
11:14
through carrier testing all over again.
11:16
In most cases, you'll get better results
11:18
using pre-certified LTE, CAT M1, NBIOT,
11:23
or even 4G modules. They're cheaper,
11:26
easier to source, and way more
11:28
forgiving, especially for low to medium
11:30
bandwidth use cases. Unless your product
11:33
truly requires high throughput and
11:35
real-time video or data streaming, 5G is
11:38
usually more pain than it's worth. Do
11:41
you want to avoid costly design
11:42
mistakes? Then be sure you grab my free
11:44
design review checklist bundle covering
11:46
the schematic, PCB layout, enclosure,
11:49
the three areas where most products go
11:51
wrong. Links below or scan this QR code.
11:55
Technology number one to avoid in your
11:58
product if at all possible is custom IC
12:01
design. This one comes up more often
12:03
than you'd expect, especially with
12:05
wearables or ultra compact products.
12:08
Founders get the idea that the only way
12:10
to fit everything into a tiny enclosure
12:13
is with a custom IC. And in theory,
12:16
that's true. Custom silicon let you
12:18
combine everything, radios, processors,
12:21
memory, everything into one sleek, small
12:24
package. But in practice, custom chip
12:26
design is a mountain you do not want to
12:28
climb. We're talking about massive
12:30
upfront cost, long lead times, highly
12:34
specialized engineering, and extremely
12:36
expensive prototyping cost. Unless
12:38
you're building the next Apple Watch and
12:41
you've raised millions of dollars, this
12:43
is not the path to take. Startups should
12:45
stick with off-the-shelf chips and
12:48
proven modules.


In this video, John Teel outlines 10 technologies that can make hardware product development nearly impossible for startups and small teams due to high complexity, cost, or lack of support. Avoiding these can prevent endless development cycles:
High-end application processors (0:41): Chips from providers like Qualcomm or Broadcom often lack documentation and support for smaller teams.
Custom RF designs (2:38): Designing custom antennas and matching networks is prone to failure and difficult to certify, especially below 2.4 GHz.
Custom battery packs (3:41): Designing custom battery shapes introduces significant safety, certification, and liability risks.
Advanced USB features (4:59): USB 3.0 or Power Delivery requires complex PCB stackups and specialized debugging tools.
Wireless charging (6:37): Inductive charging is inefficient, thermally challenging, and requires expensive Qi certification.
Proprietary/high-speed connectors (7:32): Technologies like Thunderbolt or Lightning often come with restrictive licensing and difficult integration requirements.
Overly fancy displays (8:26): OLED panels using MIPI DSI interfaces are expensive, hard to source, and require powerful, unnecessary processors.
High-end analog audio (9:48): Analog audio is highly sensitive to PCB layout and noise, making it unforgiving for teams lacking deep expertise.
5G/cutting-edge cellular (10:40): These modules are costly, thermally intensive, and require rigorous carrier-specific certifications.
Custom IC design (11:58): Developing custom silicon is a massive, expensive, and time-consuming path usually reserved for high-volume, well-funded products.



What are good microcontrollers for beginners?
How to simplify my product's power design?
Are pre-certified RF modules reliable?
Simple explanation of these risks?

The speaker explains that choosing overly advanced technologies often leads to failed product launches for small teams and startups. These risks generally fall into three categories (0:00 - 0:38):
Supply Chain & Documentation: Many high-end components, like flagship processors, are restricted. Startups often lack the volume to get essential data sheets or vendor support (0:41 - 1:35).
Technical Complexity: Complex designs (like high-speed USB or custom radio modules) require specialized engineering expertise, high-end testing tools, and rigorous PCB design techniques that are often out of reach for smaller teams (2:38 - 3:37, 4:59 - 6:35).
Compliance & Regulation: Attempting custom solutions—specifically with battery safety or cellular connectivity—triggers expensive, time-consuming, and risky certification processes that can stall a product indefinitely (3:41 - 4:57, 10:40 - 11:38).