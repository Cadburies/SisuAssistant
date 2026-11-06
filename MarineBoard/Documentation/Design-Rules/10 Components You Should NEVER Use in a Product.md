https://youtu.be/7RMo-cWtap4?si=Ze15HT-wZjDwhU2H


Chapter 1: Intro
0:000 secondsThese 10 components show up constantly in online tutorials, dev kits, and early prototypes. But if you design any of
0:088 secondsthem into a product that you plan to actually manufacture and sell, well, you could be looking at failed certifications, unreliable products,
0:1717 secondssourcing nightmares, dead on arrival units, and expensive redesigns that could have been avoided. Every one of
0:2424 secondsthese components works fine on the bench, and that's exactly what makes them so dangerous, because they trick you into thinking that they'll work in
0:3232 secondsproduction, too. So, in this video, I'm going to go through each one, explain why it doesn't belong in a real product, and tell you what to use instead. Hi,
0:4040 secondsI'm John Teal. I spent over a decade as a microchip design engineer at Texas Instruments. Then, I developed and launched my own product, and now I help
0:4848 secondsothers do the same. And component number one that you should never use in a new product is USB microB connectors. And
Chapter 2: USB MicroB
0:5656 secondsI'm going to be honest, I absolutely hate USB micro connectors. We went through multiple Amazon Kindles in our
1:031 minute, 3 secondsfamily over the years and the microB port was always the thing that ended up failing. Then we recently bought a brand
1:101 minute, 10 secondsnew Amazon Fire for our TV and I was pretty annoyed to see that it still had microb instead of USBC. And that
1:191 minute, 19 secondsfrustration isn't just mine. It's a real engineering problem. USB MicroB is one of the most notorious mechanical failure
1:271 minute, 27 secondspoints in consumer electronics. The connector is mechanically fragile, and the solder joints and internal structure can't handle the stress users put on it.
1:371 minute, 37 secondsIt fails after far fewer insertion cycles compared to USBC. And EU regulations already require USBC for
1:451 minute, 45 secondsmost consumer electronics. Beyond reliability, customers increasingly expect USBC on new products, and a
1:531 minute, 53 secondsmicroBB port signals that your product is outdated even before it ships.
1:581 minute, 58 secondsThere's really no good reason to start a new design with USB microB. And by the way, just to help you so you don't forget any of these 10 components that
2:072 minutes, 7 secondsyou need to avoid in your design, I've put together a free PDF cheat sheet covering all 10 components along with the specific alternatives that I
2:162 minutes, 16 secondsrecommend for each one. Links in the description below. Component number two that you need to avoid is throughhole components when SMD alternatives exist.
Chapter 3: Throughhole Components
2:262 minutes, 26 secondsThrough hole parts are bigger, harder to place with automated assembly equipment, and they drive up manufacturing cost.
2:332 minutes, 33 secondsPeople coming from the hobbyist world default to through hole because that's what they learn to solder by hand. But if a surface mount device or SMD
2:422 minutes, 42 secondsequivalent exists, and it almost always does, then you should use it.
2:462 minutes, 46 secondsthroughhole components require wave soldering or hand soldering as a separate step after SMD reflow and that
2:542 minutes, 54 secondsadds both cost and complexity to every single production run. Now, there are legitimate exceptions like connectors
3:013 minutes, 1 secondthat need mechanical anchor strength, some larger power components, and certain high reliability applications,
3:073 minutes, 7 secondsbut for the vast majority of components, whether that be resistors, capacitors, or IC's, then SMD is the right choice.
Chapter 4: Barrel Jacks
3:163 minutes, 16 secondsComponent number three to avoid are barrel jack power connectors. So, barrel jacks are frustrating from an engineering standpoint, but they're even
3:253 minutes, 25 secondsworse from a customer experience standpoint. With USBC, your customer already has a dozen chargers lying
3:323 minutes, 32 secondsaround the house that will work. But with a barrel jack, they have to keep track of that one specific adapter that came in the box with the product. I've
3:413 minutes, 41 secondsowned products where I lost the barrel jack charger, and trying to find a replacement with the right size, right polarity, and right current rating is
3:493 minutes, 49 secondssuch a hassle that I just ended up throwing it away and buying a new product instead. That's the kind of experience you do not want your
3:563 minutes, 56 secondscustomers to have. On the engineering side, there are too many similar but compatible sizes. So, a 5.5x 2.1 mm plug
4:064 minutes, 6 secondslooks almost identical to a 5.5x 2.5 mm plug, but one won't fit right in
4:134 minutes, 13 secondsthe other's jack. There's commonly no built-in polarity protection, which means if a customer plugs in the wrong
4:204 minutes, 20 secondsadapter, well, they can fry the board instantly. For most low to moderate power consumer products, USBC is the
4:284 minutes, 28 secondsbetter default. And if you need more current, then look at USBC power delivery or a locking connector rated for your specific current requirements.
Chapter 5: Unshielded Inductors
4:384 minutes, 38 secondsComponent number four to avoid are unshielded DCDC converter inductors.
4:434 minutes, 43 secondsSwitching regulators are everywhere in product designs, but pairing one with an unshielded inductor is asking for EMI
4:504 minutes, 50 secondstrouble. The magnetic field from an unshielded inductor radiates freely, couples into nearby traces, and
4:574 minutes, 57 secondscontaminates sensitive analog or RF sections of your board. This often shows up as noise in a pre-compliance scan, or
5:055 minutes, 5 secondsworse, an outright failure at the test lab when you're paying thousands of dollars for certification testing.
5:125 minutes, 12 secondsShielded or semi-shielded inductors from manufacturers like Worth, Coilcraft or TDK cost only slightly more per unit and they reduce radiated EMI significantly.
5:255 minutes, 25 secondsThough good layout around your switching regulator is still always super critical for EMI. So, that tiny savings on your
5:325 minutes, 32 secondsBOM that you got by using an unshielded inductor can easily turn into a $5,000 or more certification failure if your design doesn't pass EMC testing.
5:435 minutes, 43 secondsComponent number five to avoid are cheap, no-name electrolytic capacitors.
5:495 minutes, 49 secondsCheap electrolytics can dry out early, drift out of spec, and slowly destroy your product's reliability over one to
5:575 minutes, 57 secondsthree years, long after the warranty period has expired. This is one component category where brand matters.
6:036 minutes, 3 secondsSo, be sure that you stick with the better known brands. Even better, switch to ceramic or polymer aluminum capacitors where your design allows it.
6:126 minutes, 12 secondsAnd if your contract manufacturer is substituting mystery brand capacitors into your BOM without your approval,
6:206 minutes, 20 secondswell, that's a BOM control problem that you need to fix immediately. Component number six you need to avoid are bare
Chapter 6: Bare pin headers
6:276 minutes, 27 secondspin headers as production connectors. So bare pin headers are perfect for prototyping, but they're terrible for anything that actually ships to a
6:366 minutes, 36 secondscustomer. They have no locking mechanism and no strain relief, which means that they vibrate loose and anything that
6:436 minutes, 43 secondsgets moved, shipped, or even just handled roughly. They're also easy to accidentally plug in where it's offset
6:496 minutes, 49 secondsby one pin since there's no keying to prevent that. And that can damage your board or any connected components. So
6:576 minutes, 57 secondsinstead, use connectors rated for your application with proper retention and keying and stick with well-known brand
7:057 minutes, 5 secondsnames. The cost increase is usually justified by the reliability and usability improvement for your product.
Chapter 7: Mechanical relays
7:127 minutes, 12 secondsThe next component you need to avoid are mechanical relays. So mechanical relays wear out after a limited number of
7:197 minutes, 19 secondscycles. They're loud, they're physically large, and they draw significant coil current. For many products, especially
7:267 minutes, 26 secondsbattery powered or compact designs, a solid state alternative is a much better choice since there are no moving parts,
7:347 minutes, 34 secondsno audible click, they're a fraction of the size, and they dramatically have a longer life, and for DC loads, a MOSFET
7:427 minutes, 42 secondsis often the first thing to consider over a relay. Mechanical relays do have their place for things like high current switching or where you have specific
7:517 minutes, 51 secondsisolation requirements, but founders default to them way too often simply because they're simple to understand. So
7:597 minutes, 59 secondsbefore locking in a mechanical relay, ask yourself whether you actually need the specific properties that it provides because most of the time you don't.
Chapter 8: Endoflife components
8:088 minutes, 8 secondsComponent number eight are single source or endoflife components. If only one factory on planet Earth makes your
8:158 minutes, 15 secondscritical component, well, you're just one supply disruption away from a dead product. The CO chip shortage made this
8:238 minutes, 23 secondspainfully obvious and it will most likely happen again. End of life components are even worse because you're designing on a countdown timer that you
8:318 minutes, 31 secondsmay not even know about. So, always check life cycle status before committing any component to your BOM and
8:388 minutes, 38 secondslook for second source alternatives. If no second source exists, well, that's a risk that you need to consciously accept
8:458 minutes, 45 secondsupfront and not discover later when you're trying to place a production order. This is especially dangerous for startups with long development timelines
8:548 minutes, 54 secondsbecause your key part can go end of life before you even ship your first unit.
Chapter 9: Counterfeit ICs
8:598 minutes, 59 secondsPart number nine to avoid are counterfeit or clone IC's. Fake STM32s, cloned FTDI chips, and suspiciously
9:089 minutes, 8 secondscheap original components from unauthorized distributors are more common than most people realize. They
9:159 minutes, 15 secondspass bench testing just often enough to make it into a production run, and then they fail in the field as scale when
9:229 minutes, 22 secondsit's far too late and too expensive to fix. Common signs include pricing that seems too good to be true, packaging
9:309 minutes, 30 secondsinconsistencies, and unusual behavior under edge conditions. The fix is simple. Buy from authorized distributors
9:389 minutes, 38 secondslike Mouser, Digi Key, or Arrow. Just note that if you're sourcing IC's from Alibaba, for example, just to save a few
9:469 minutes, 46 secondscents per chip, that you're gambling your entire production run. And hey, don't forget your free checklist covering all the 10 components I'm discussing in this video. Component
Chapter 10: Hobbygrade Sensors
9:549 minutes, 54 secondsnumber 10 that you need to avoid in a new product are hobbygrade sensors.
9:589 minutes, 58 secondsProduct creators love carrying over the sensors that they used in their first Arduino or ESP32 prototype. And I get
10:0610 minutes, 6 secondsthe appeal because they're cheap, easy to wire up, and everywhere online. But sensors like the DHT11 or the MQ series
10:1510 minutes, 15 secondsgas sensors were never designed for production products. and they show it through low accuracy, poor long-term
10:2210 minutes, 22 secondsstability, and inconsistent performance across units. The common thread with all hobby grade sensors is that they work
10:2910 minutes, 29 secondswell enough on a bench to make you think that they'll work in production, but they lack the consistency and reliability that your customers will
10:3710 minutes, 37 secondsexpect. So, when you're choosing sensors for a real commercial product, look for parts from reputable suppliers that offer factory calibration, standard
10:4610 minutes, 46 secondsdigital interfaces like I2C or SPI, and include solid documentation. If you want expert help catching problems like these
10:5410 minutes, 54 secondsbefore they cost you time and money, you can get that help inside my hardware academy or with private mentoring with me. If you found this video helpful,
11:0211 minutes, 2 secondsthen I suggest watching my video on the 10 technologies to avoid when developing your new product.

This video, presented by John Teel, a former microchip design engineer at Texas Instruments, outlines 10 common components that should be avoided in commercial product designs to prevent reliability issues, manufacturing difficulties, and certification failures.
The 10 Components to Avoid:
USB Micro-B Connectors: Mechanically fragile and prone to failure (0:51).
Through-hole Components: More expensive and difficult to assemble than SMD (Surface Mount Device) alternatives (2:20).
Barrel Jack Power Connectors: Often lack polarity protection and create poor customer experiences (3:18).
Unshielded DC-DC Converter Inductors: Cause significant EMI (Electromagnetic Interference) issues (4:38).
Cheap, No-name Electrolytic Capacitors: Lead to long-term reliability degradation (5:45).
Bare Pin Headers: Lack strain relief and locking mechanisms for production (6:25).
Mechanical Relays: Prone to wear and are physically large compared to solid-state alternatives (7:13).
Single-Source or End-of-Life Components: Create supply chain risks (8:08).
Counterfeit or Clone ICs: Often fail under stress and at scale (9:01).
Hobby-Grade Sensors: Lack the accuracy and consistency required for commercial products (9:54).



Why are SMD components better for manufacturing?
What components should I avoid?

According to the video, you should avoid these 10 components to prevent manufacturing issues, unreliability, and certification failures:
USB Micro-B Connectors (0:51): These are mechanically fragile and prone to failure compared to USB-C.
Through-hole Components (2:20): These increase manufacturing cost and complexity; use SMD (Surface Mount Device) versions when available.
Barrel Jack Power Connectors (3:18): They often lack polarity protection and lead to a poor user experience compared to standardized USB-C.
Unshielded DC-DC Converter Inductors (4:38): These cause EMI (Electromagnetic Interference) issues that often lead to failed certification testing.
Cheap, No-name Electrolytic Capacitors (5:45): These can dry out and degrade over time; stick to known, high-quality brands.
Bare Pin Headers (6:25): These lack locking mechanisms and strain relief, making them unsuitable for production products.
Mechanical Relays (7:13): They wear out and are bulky; prefer solid-state alternatives or MOSFETs for DC loads.
Single-Source or End-of-Life Components (8:08): Relying on these creates significant supply chain risk and potential for product discontinuation.
Counterfeit or Clone ICs (9:01): These often fail during stress testing or at scale; always purchase from authorized distributors.
Hobby-Grade Sensors (9:54): Devices like the DHT11 lack the accuracy and long-term stability required for commercial applications.



Why are through-hole components more expensive?
How do I verify a component's lifecycle status?
Why avoid hobby-grade sensors?

According to the video (9:54 - 10:50), hobby-grade sensors (such as the DHT11 or MQ series gas sensors) should be avoided in commercial product designs for the following reasons:
Inconsistent Performance: They lack the necessary reliability and consistency across different units required for commercial products.
Poor Quality Standards: They suffer from low accuracy and poor long-term stability, meaning they will not perform reliably over the lifespan of a consumer product.
Misleading Testing: While they often work well enough for simple Arduino or ESP32 prototypes on a test bench, they are not engineered to handle the real-world conditions or production standards expected by customers.
For professional applications, the video recommends sourcing parts from reputable suppliers that provide factory calibration, standard digital interfaces (like I2C or SPI), and solid, professional-grade documentation.



Where can I buy industrial sensors?
How to calibrate electronic sensors?
List parts for production use?

For commercial product manufacturing, you should prioritize components that offer reliability, long-term availability, and compatibility with automated assembly. Based on the video, here are professional-grade alternatives to common hobbyist parts:
Connectors: Standardize on USB-C instead of USB Micro-B or barrel jacks (0:51, 3:18). USB-C is more robust and expected by consumers.
Assembly: Always choose SMD (Surface Mount Device) components over through-hole parts when available (2:20) to reduce manufacturing costs and assembly complexity.
Inductors: Use shielded or semi-shielded inductors from reputable manufacturers like Würth, Coilcraft, or TDK to prevent EMI (Electromagnetic Interference) issues (4:38).
Capacitors: Select high-quality, branded electrolytic capacitors, or better yet, use ceramic or polymer aluminum capacitors to ensure long-term stability (5:45).
Interconnects: Use rated, keyed, and locking connectors (e.g., from JST or Molex) instead of bare pin headers for production (6:25).
Switching: Prefer solid-state relays or MOSFETs over mechanical relays for DC loads to increase lifespan and reduce board size (7:13).
Sensors: Choose industrial-grade sensors from reputable suppliers that provide factory calibration, solid documentation, and standard digital interfaces like I2C or SPI (9:54).



How to verify component lifecycle status?
Where to source reliable electronic parts?
Benefits of I2C over analog interfaces?
How to check component lifecycle status?

Checking the lifecycle status of an electronic component is a critical step in product design to avoid supply chain disruptions (8:08 - 8:33). To effectively manage and verify part availability, you should follow these steps:
Verify at the Source: Always start by checking the original component manufacturer’s (OCM) website. This is the most reliable and authoritative source for official status updates.
Use Aggregator Tools: Utilize platforms like Octopart or FindChips to search for your specific manufacturer part number. These aggregators often provide real-time status indicators (e.g., Active, NRND - Not Recommended for New Designs, or Obsolete).
Monitor Distributor Notices: Large, authorized distributors like DigiKey and Mouser often display lifecycle information and send out EOL (End-of-Life) notices for components in your inventory or purchase history.
Understand Status Codes:
Active: Part is currently in production.
NRND (Not Recommended for New Designs): A strong indicator that the part is nearing the end of its life and should not be used in new projects.
Obsolete: The part is no longer manufactured.
Consult Your Manufacturing Partner: If you are outsourcing assembly, your contract manufacturer often has dedicated systems to track component lifecycles on a regular cycle (e.g., every 6 months) and can notify you of potential risks.

How to Decode Lifecycle Status - Octopart

octopart.com
 
How to Check Electronic Component Lifecycle Status
ntchip.com
 Determining End-Of-Life for electronic components
stackexchange.com
 



How to find component alternatives?
When to choose second-source parts?
Best practices for reducing EMI in PCB design?

Reducing Electromagnetic Interference (EMI) is a critical aspect of PCB design to ensure compliance and reliable performance. As highlighted in the video (4:38-5:43), component selection—specifically choosing shielded inductors—is a vital first step, but a robust layout is equally essential for noise control.
Key Best Practices for EMI Mitigation:
Solid Ground Planes: Use a continuous ground plane to provide a low-impedance return path for signals, which significantly reduces loop area and radiated emissions.
Optimized Routing: Keep trace routes as short and direct as possible to minimize inductive loops. Avoid sharp right-angle bends in your traces.
Signal Isolation: Separate high-speed, digital, and analog sections of the board to prevent cross-talk and noise coupling between sensitive areas.
Return Path Integrity: Ensure return paths are continuous across layers; avoid routing traces over splits in the ground plane.
Shielding: For designs where standard layout practices aren't sufficient, consider board-level shielding to contain radiated emissions from high-frequency or high-power components.

Board-Level Shielding Techniques for Reducing EMI in PCB Design

aisler.net
 
Tips for Reducing EMI in PCB Designs - Deep Coat Industries
deepcoat.com
 7 Best Practices to Manage EMI in your PCBs - Design and Layout
protoexpress.com
 Switch PCB Layout: Best Practices for Reducing EMI and Noise
allpcb.com
 



How to test for EMI issues?
Why choose shielded over unshielded inductors?
Explain PCB ground plane importance.
What are recommended authorized electronics distributors?

To ensure component authenticity and avoid the risks associated with counterfeit or clone integrated circuits, it is essential to source parts from authorized distributors. As mentioned in the video (9:35 - 9:48), these distributors maintain direct relationships with manufacturers, guaranteeing the quality and provenance of the parts they sell.
Recommended authorized electronics distributors include:
Mouser Electronics: A global distributor known for a massive inventory of electronic components and semiconductors.
DigiKey: Renowned for its extensive product selection and rapid shipping capabilities.
Arrow Electronics: A major provider of industrial and commercial electronic components with global supply chain services.
Sourcing from these reputable suppliers, rather than unauthorized marketplaces, is critical to protecting the reliability and integrity of your final production run.



How to verify a component's origin?
Risks of using unauthorized marketplaces?
Are there other reliable component suppliers?
What is the NRND status code?

The NRND status code stands for "Not Recommended for New Designs." According to the video, this status is a critical warning that a component is nearing the end of its life cycle and should not be selected for any new product developments. Choosing a part with this designation puts a project at risk of needing a sudden and expensive redesign if the part becomes unavailable before production begins. (8:27 - 8:58)



What are common supply chain risks?
Explain the importance of second-source alternatives.
What defines a professional-grade sensor?

Selecting sensors for commercial manufacturing requires moving beyond hobbyist components to parts engineered for consistency, reliability, and long-term stability (9:54-10:50). Professional-grade sensors are defined by several critical characteristics that ensure they perform predictably under real-world conditions:
Factory Calibration: Unlike hobby-grade parts, professional sensors undergo precise factory calibration. Manufacturers align these devices to specific design ranges using specialized procedures, which guarantees that every unit meets the same accuracy tolerances. This is essential for maintaining product quality across large-scale production runs.
Robust Documentation: Professional components provide comprehensive documentation, including detailed datasheets, application notes, and design-in guidelines. This transparency is necessary for engineers to properly integrate the part, assess compliance with standards (like RoHS or IEC requirements), and build reliable circuitry.
Reliable Digital Interfaces: Commercial designs prioritize standardized digital communication protocols such as I2C or SPI (10:46). These interfaces offer stable, noise-resistant data transmission that is far more reliable for integrated products than the raw analog signals or non-standard protocols often found in hobbyist modules.
Environmental Ruggedness: Beyond signal quality, professional sensors are often built to withstand harsher operating conditions, such as temperature extremes, vibration, or moisture, and may feature higher Ingress Protection (IP) ratings or specialized packaging to ensure they do not drift or fail prematurely in the field.
Top 5 Quality Standards in Electronic Components and What They ...

broadlinecomponents.com
 
The Difference Between Industrial, Commercial and Residential ...
fiercesensors.com
 The Importance of Calibrating Measurement Instrumentation
dwyer-inst.com
 



How to verify sensor datasheet accuracy?
What is the difference between I2C and SPI?
How do I verify part availability?

Verifying the availability and lifecycle status of electronic components is a critical step in product design to avoid supply chain disruptions, as discussed in the video (8:08 - 8:33). To effectively manage your Bill of Materials (BOM), follow these best practices:
Check at the Source: Always verify the status directly on the original component manufacturer’s website. This is the most reliable method to confirm if a part is Active, Not Recommended for New Designs (NRND), or Obsolete.
Use Aggregator Tools: Platforms like Octopart or FindChips allow you to search for specific manufacturer part numbers. These services aggregate data from multiple distributors to provide real-time updates on stock, pricing, and lifecycle status.
Monitor Notifications: Sign up for Product Change Notifications (PCN) or Product Discontinuation Notices (PDN) to receive alerts directly from manufacturers when a part’s lifecycle status changes.
Plan for Continuity:
Always identify second-source alternatives for critical components early in the design process.
If you are outsourcing manufacturing, consult with your partner, as many contract manufacturers perform lifecycle checks during the production planning phase (e.g., on a 6-month cycle).
Leverage Supply Chain Platforms: For professional-scale projects, consider using integrated supply chain and BOM management software. These tools provide real-time visibility into global inventory and risk, helping you proactively mitigate sourcing nightmares.

Electronic Component Lifecycle: Active, NRND, and EOL Explained

cosolvic.com
 
How to Check Electronic Component Lifecycle Status
ntchip.com
 How to Decode Lifecycle Status - Octopart
octopart.com
 The Top 8 Electronic Supply Chain Solutions for Sourcing ... - Z2Data
z2data.com
 



How to manage obsolete components in BOM?
What are common electronic component lifecycle stages?
Why do manufacturers mark parts NRND?
Best practices for sensor PCB integration?

Integrating sensors into a professional PCB design requires prioritizing reliability, accuracy, and signal integrity. Beyond avoiding hobby-grade components (9:54 - 10:50), follow these industry best practices to ensure your product performs consistently at scale:
Key Integration Guidelines:
Standardized Digital Interfaces: Always favor digital protocols like I2C or SPI (10:46) over analog signals. Digital interfaces are inherently more robust against environmental noise, which is critical for maintaining data accuracy.
Factory Calibration: Select parts from reputable manufacturers that guarantee factory calibration (10:43). This eliminates the need for complex, unit-by-unit calibration on your assembly line, saving time and reducing production variance.
Strategic Placement: Place sensors away from high-noise areas of the board, such as switching regulators or high-frequency traces. Use local decoupling capacitors near the sensor power pins to filter out supply noise.
Proper Documentation: Rely strictly on components with comprehensive datasheets and verified application notes (10:50). This documentation ensures you correctly implement the manufacturer’s recommended circuit and software drivers.
Thermal Management: If your sensor is sensitive to heat (like gas or humidity sensors), place it away from heat-generating components (e.g., processors, power MOSFETs) and consider mechanical ventilation or thermal isolation gaps in the PCB design.