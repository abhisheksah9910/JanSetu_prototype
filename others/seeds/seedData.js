require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Challenge = require('../models/Challenge');
const University = require('../models/University');
const IndustryPartner = require('../models/IndustryPartner');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const Comment = require('../models/Comment');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/innovatesphere';

const ALL_INDIA_LOCATIONS = [
  // Jharkhand (home state)
  { state: 'Jharkhand', district: 'Ranchi',           city: 'Ranchi',      lat: 23.3441, lng: 85.3096 },
  { state: 'Jharkhand', district: 'Dhanbad',          city: 'Dhanbad',     lat: 23.7957, lng: 86.4304 },
  { state: 'Jharkhand', district: 'Jamshedpur',       city: 'Jamshedpur',  lat: 22.8046, lng: 86.2029 },
  { state: 'Jharkhand', district: 'Bokaro',            city: 'Bokaro',      lat: 23.6693, lng: 86.1511 },
  { state: 'Jharkhand', district: 'Hazaribagh',        city: 'Hazaribagh',  lat: 23.9961, lng: 85.3613 },
  { state: 'Jharkhand', district: 'Gumla',             city: 'Gumla',       lat: 23.0433, lng: 84.5414 },
  { state: 'Jharkhand', district: 'Simdega',           city: 'Simdega',     lat: 22.6096, lng: 84.5083 },
  { state: 'Jharkhand', district: 'West Singhbhum',    city: 'Chaibasa',    lat: 22.5544, lng: 85.8096 },
  // Maharashtra
  { state: 'Maharashtra', district: 'Mumbai',          city: 'Mumbai',      lat: 19.0760, lng: 72.8777 },
  { state: 'Maharashtra', district: 'Pune',             city: 'Pune',        lat: 18.5204, lng: 73.8567 },
  { state: 'Maharashtra', district: 'Nashik',           city: 'Nashik',      lat: 19.9975, lng: 73.7898 },
  { state: 'Maharashtra', district: 'Vidarbha',         city: 'Amravati',    lat: 20.9320, lng: 77.7523 },
  { state: 'Maharashtra', district: 'Marathwada',       city: 'Aurangabad',  lat: 19.8762, lng: 75.3433 },
  // Delhi
  { state: 'Delhi', district: 'New Delhi',              city: 'New Delhi',   lat: 28.6139, lng: 77.2090 },
  { state: 'Delhi', district: 'East Delhi',             city: 'East Delhi',  lat: 28.6600, lng: 77.3000 },
  { state: 'Delhi', district: 'North Delhi',            city: 'North Delhi', lat: 28.7200, lng: 77.1800 },
  // Uttar Pradesh
  { state: 'Uttar Pradesh', district: 'Lucknow',        city: 'Lucknow',     lat: 26.8467, lng: 80.9462 },
  { state: 'Uttar Pradesh', district: 'Varanasi',       city: 'Varanasi',    lat: 25.3176, lng: 82.9739 },
  { state: 'Uttar Pradesh', district: 'Agra',           city: 'Agra',        lat: 27.1767, lng: 78.0081 },
  { state: 'Uttar Pradesh', district: 'Kanpur',         city: 'Kanpur',      lat: 26.4499, lng: 80.3319 },
  { state: 'Uttar Pradesh', district: 'Allahabad',      city: 'Prayagraj',   lat: 25.4358, lng: 81.8463 },
  // Rajasthan
  { state: 'Rajasthan', district: 'Jaipur',             city: 'Jaipur',      lat: 26.9124, lng: 75.7873 },
  { state: 'Rajasthan', district: 'Jodhpur',            city: 'Jodhpur',     lat: 26.2389, lng: 73.0243 },
  { state: 'Rajasthan', district: 'Barmer',             city: 'Barmer',      lat: 25.7478, lng: 71.3939 },
  { state: 'Rajasthan', district: 'Bikaner',            city: 'Bikaner',     lat: 28.0229, lng: 73.3119 },
  // Karnataka
  { state: 'Karnataka', district: 'Bengaluru Urban',    city: 'Bengaluru',   lat: 12.9716, lng: 77.5946 },
  { state: 'Karnataka', district: 'Mysuru',             city: 'Mysuru',      lat: 12.2958, lng: 76.6394 },
  { state: 'Karnataka', district: 'Belagavi',           city: 'Belagavi',    lat: 15.8497, lng: 74.4977 },
  // Tamil Nadu
  { state: 'Tamil Nadu', district: 'Chennai',           city: 'Chennai',     lat: 13.0827, lng: 80.2707 },
  { state: 'Tamil Nadu', district: 'Coimbatore',        city: 'Coimbatore',  lat: 11.0168, lng: 76.9558 },
  { state: 'Tamil Nadu', district: 'Madurai',           city: 'Madurai',     lat: 9.9252, lng: 78.1198 },
  { state: 'Tamil Nadu', district: 'Trichy',            city: 'Trichy',      lat: 10.7905, lng: 78.7047 },
  // Gujarat
  { state: 'Gujarat', district: 'Ahmedabad',            city: 'Ahmedabad',   lat: 23.0225, lng: 72.5714 },
  { state: 'Gujarat', district: 'Surat',                city: 'Surat',       lat: 21.1702, lng: 72.8311 },
  { state: 'Gujarat', district: 'Kutch',                city: 'Bhuj',        lat: 23.2419, lng: 69.6669 },
  // West Bengal
  { state: 'West Bengal', district: 'Kolkata',          city: 'Kolkata',     lat: 22.5726, lng: 88.3639 },
  { state: 'West Bengal', district: 'Howrah',           city: 'Howrah',      lat: 22.5958, lng: 88.2636 },
  { state: 'West Bengal', district: 'Sundarbans',       city: 'Basirhat',    lat: 22.6554, lng: 88.8774 },
  // Madhya Pradesh
  { state: 'Madhya Pradesh', district: 'Bhopal',        city: 'Bhopal',      lat: 23.2599, lng: 77.4126 },
  { state: 'Madhya Pradesh', district: 'Indore',         city: 'Indore',      lat: 22.7196, lng: 75.8577 },
  { state: 'Madhya Pradesh', district: 'Gwalior',       city: 'Gwalior',     lat: 26.2183, lng: 78.1828 },
  // Odisha
  { state: 'Odisha', district: 'Bhubaneswar',           city: 'Bhubaneswar', lat: 20.2961, lng: 85.8189 },
  { state: 'Odisha', district: 'Cuttack',               city: 'Cuttack',     lat: 20.4625, lng: 85.8830 },
  { state: 'Odisha', district: 'Koraput',               city: 'Koraput',     lat: 18.8135, lng: 82.7130 },
  // Bihar
  { state: 'Bihar', district: 'Patna',                  city: 'Patna',       lat: 25.5941, lng: 85.1376 },
  { state: 'Bihar', district: 'Gaya',                   city: 'Gaya',        lat: 24.7968, lng: 85.0097 },
  { state: 'Bihar', district: 'Muzaffarpur',            city: 'Muzaffarpur', lat: 26.1209, lng: 85.3647 },
  // Assam
  { state: 'Assam', district: 'Guwahati',               city: 'Guwahati',    lat: 26.1445, lng: 91.7362 },
  { state: 'Assam', district: 'Silchar',                city: 'Silchar',     lat: 24.8333, lng: 92.7789 },
  // Andhra Pradesh
  { state: 'Andhra Pradesh', district: 'Visakhapatnam', city: 'Vizag',       lat: 17.6868, lng: 83.2185 },
  { state: 'Andhra Pradesh', district: 'Vijayawada',    city: 'Vijayawada',  lat: 16.5062, lng: 80.6480 },
  // Telangana
  { state: 'Telangana', district: 'Hyderabad',          city: 'Hyderabad',   lat: 17.3850, lng: 78.4867 },
  { state: 'Telangana', district: 'Warangal',           city: 'Warangal',    lat: 17.9784, lng: 79.5941 },
  // Punjab
  { state: 'Punjab', district: 'Amritsar',              city: 'Amritsar',    lat: 31.6340, lng: 74.8723 },
  { state: 'Punjab', district: 'Ludhiana',              city: 'Ludhiana',    lat: 30.9010, lng: 75.8573 },
  // Haryana
  { state: 'Haryana', district: 'Gurugram',             city: 'Gurugram',    lat: 28.4595, lng: 77.0266 },
  { state: 'Haryana', district: 'Faridabad',            city: 'Faridabad',   lat: 28.4089, lng: 77.3178 },
  // Kerala
  { state: 'Kerala', district: 'Thiruvananthapuram',    city: 'Trivandrum',  lat: 8.5241, lng: 76.9366 },
  { state: 'Kerala', district: 'Kochi',                 city: 'Kochi',       lat: 9.9312, lng: 76.2673 },
  // Chhattisgarh
  { state: 'Chhattisgarh', district: 'Raipur',          city: 'Raipur',      lat: 21.2514, lng: 81.6296 },
  { state: 'Chhattisgarh', district: 'Bastar',          city: 'Jagdalpur',   lat: 19.0760, lng: 82.0330 },
  // Uttarakhand
  { state: 'Uttarakhand', district: 'Dehradun',         city: 'Dehradun',    lat: 30.3165, lng: 78.0322 },
  { state: 'Uttarakhand', district: 'Chamoli',          city: 'Gopeshwar',   lat: 30.4105, lng: 79.3081 },
];

const UNIVERSITIES_DATA = [
  {
    name: 'Indian Institute of Technology (ISM) Dhanbad',
    shortName: 'IIT (ISM)',
    type: 'iit',
    location: { city: 'Dhanbad', district: 'Dhanbad', state: 'Jharkhand', address: 'Sindri Road, Dhanbad' },
    contact: { email: 'contact@iitism.ac.in', phone: '0326-2296000', website: 'https://www.iitism.ac.in' },
    expertiseDomains: ['Energy & Technology', 'Urban Infrastructure', 'Agriculture', 'Water Management'],
    departments: ['Computer Science', 'Mining Engineering', 'Environmental Engineering', 'Mechanical Engineering', 'Chemical Engineering'],
    facilities: { hasIncubationCenter: true, hasResearchLab: true, hasInnovationHub: true, hasTBICenter: true },
    naacGrade: 'A++',
    facultyCount: 450,
    studentCount: 8500,
    stats: { totalAssigned: 28, totalResolved: 18, totalInProgress: 8, averageResolutionDays: 85, totalPatents: 23, totalStartups: 7, performanceScore: 94 },
    isActive: true, isVerified: true, establishedYear: 1926
  },
  {
    name: 'National Institute of Technology Jamshedpur',
    shortName: 'NIT JSR',
    type: 'nit',
    location: { city: 'Jamshedpur', district: 'East Singhbhum', state: 'Jharkhand', address: 'Adityapur, Jamshedpur' },
    contact: { email: 'director@nitjsr.ac.in', phone: '0657-2373406', website: 'https://www.nitjsr.ac.in' },
    expertiseDomains: ['Urban Infrastructure', 'Energy & Technology', 'Water Management', 'Sanitation & Environment'],
    departments: ['Civil Engineering', 'Electrical Engineering', 'Electronics', 'Mechanical Engineering', 'Computer Science'],
    facilities: { hasIncubationCenter: true, hasResearchLab: true, hasInnovationHub: true, hasTBICenter: false },
    naacGrade: 'A',
    facultyCount: 320,
    studentCount: 6800,
    stats: { totalAssigned: 22, totalResolved: 14, totalInProgress: 6, averageResolutionDays: 92, totalPatents: 15, totalStartups: 4, performanceScore: 88 },
    isActive: true, isVerified: true, establishedYear: 1960
  },
  {
    name: 'Birsa Agricultural University',
    shortName: 'BAU Ranchi',
    type: 'state',
    location: { city: 'Ranchi', district: 'Ranchi', state: 'Jharkhand', address: 'Kanke, Ranchi' },
    contact: { email: 'registrar@bau.ac.in', phone: '0651-2450610', website: 'https://www.bau.ac.in' },
    expertiseDomains: ['Agriculture', 'Water Management', 'Rural Livelihoods', 'Sanitation & Environment'],
    departments: ['Agronomy', 'Horticulture', 'Soil Science', 'Plant Breeding', 'Agricultural Extension'],
    facilities: { hasIncubationCenter: false, hasResearchLab: true, hasInnovationHub: false, hasTBICenter: false },
    naacGrade: 'B++',
    facultyCount: 280,
    studentCount: 4200,
    stats: { totalAssigned: 18, totalResolved: 12, totalInProgress: 4, averageResolutionDays: 110, totalPatents: 8, totalStartups: 2, performanceScore: 78 },
    isActive: true, isVerified: true, establishedYear: 1981
  },
  {
    name: 'Ranchi University',
    shortName: 'RU',
    type: 'state',
    location: { city: 'Ranchi', district: 'Ranchi', state: 'Jharkhand', address: 'Ranchi University Road, Ranchi' },
    contact: { email: 'info@ranchiuniversity.ac.in', phone: '0651-2203000', website: 'https://www.ranchiuniversity.ac.in' },
    expertiseDomains: ['Education', 'Healthcare', 'Public Administration', 'Rural Livelihoods', 'Accessibility'],
    departments: ['Social Work', 'Public Health', 'Economics', 'Political Science', 'Law', 'Education'],
    facilities: { hasIncubationCenter: false, hasResearchLab: true, hasInnovationHub: false, hasTBICenter: false },
    naacGrade: 'B+',
    facultyCount: 520,
    studentCount: 85000,
    stats: { totalAssigned: 15, totalResolved: 8, totalInProgress: 5, averageResolutionDays: 130, totalPatents: 3, totalStartups: 1, performanceScore: 68 },
    isActive: true, isVerified: true, establishedYear: 1960
  },
  {
    name: 'Xavier Institute of Social Service',
    shortName: 'XISS',
    type: 'private',
    location: { city: 'Ranchi', district: 'Ranchi', state: 'Jharkhand', address: 'P.O. Purulia Road, Ranchi' },
    contact: { email: 'director@xiss.ac.in', phone: '0651-2200792', website: 'https://www.xiss.ac.in' },
    expertiseDomains: ['Rural Livelihoods', 'Healthcare', 'Education', 'Accessibility', 'Public Administration'],
    departments: ['Rural Management', 'Human Resource Management', 'Marketing', 'Finance', 'Information Technology'],
    facilities: { hasIncubationCenter: true, hasResearchLab: false, hasInnovationHub: true, hasTBICenter: false },
    naacGrade: 'A',
    facultyCount: 85,
    studentCount: 1200,
    stats: { totalAssigned: 12, totalResolved: 9, totalInProgress: 3, averageResolutionDays: 75, totalPatents: 2, totalStartups: 3, performanceScore: 82 },
    isActive: true, isVerified: true, establishedYear: 1955
  }
];

const INDUSTRY_PARTNERS_DATA = [
  {
    name: 'Tata Steel Foundation',
    type: 'csr',
    sector: 'Multiple',
    description: 'CSR arm of Tata Steel driving community development in Jharkhand',
    location: { city: 'Jamshedpur', state: 'Jharkhand' },
    contact: { email: 'foundation@tatasteel.com', website: 'https://www.tatasteel.com' },
    capabilities: { canMentor: true, canFund: true, canCoDevelop: true, canPilot: true, canProvideInfrastructure: true },
    fundingCapacity: 'above_1Cr',
    stats: { totalCollaborations: 12, activeCollaborations: 5, completedProjects: 7, totalFunding: 5000000, studentsImpacted: 450 },
    isActive: true, isVerified: true
  },
  {
    name: 'Jharkhand Startup Hub',
    type: 'innovation_hub',
    sector: 'Multiple',
    description: 'Government-backed startup ecosystem for Jharkhand entrepreneurs',
    location: { city: 'Ranchi', state: 'Jharkhand' },
    contact: { email: 'hub@jharkhandstartup.in', website: 'https://jharkhandstartup.in' },
    capabilities: { canMentor: true, canFund: true, canCoDevelop: true, canPilot: false, canProvideInfrastructure: true },
    fundingCapacity: '25L_to_1Cr',
    stats: { totalCollaborations: 8, activeCollaborations: 4, completedProjects: 4, totalFunding: 2000000, studentsImpacted: 200 },
    isActive: true, isVerified: true
  },
  {
    name: 'CSIR - National Environmental Engineering Research Institute',
    type: 'research_lab',
    sector: 'Sanitation & Environment',
    description: 'Premier research institute for environmental engineering solutions',
    location: { city: 'Nagpur', state: 'Maharashtra' },
    contact: { email: 'neeri@csir.res.in', website: 'https://www.neeri.res.in' },
    capabilities: { canMentor: true, canFund: false, canCoDevelop: true, canPilot: true, canProvideInfrastructure: false },
    fundingCapacity: 'na',
    stats: { totalCollaborations: 6, activeCollaborations: 2, completedProjects: 4, totalFunding: 0, studentsImpacted: 120 },
    isActive: true, isVerified: true
  },
  {
    name: 'Rural Technology Action Group',
    type: 'ngo',
    sector: 'Rural Livelihoods',
    description: 'NGO focusing on appropriate technology solutions for rural communities',
    location: { city: 'Dhanbad', state: 'Jharkhand' },
    contact: { email: 'info@rutag.org.in' },
    capabilities: { canMentor: true, canFund: false, canCoDevelop: true, canPilot: true, canProvideInfrastructure: false },
    fundingCapacity: '5L_to_25L',
    stats: { totalCollaborations: 10, activeCollaborations: 3, completedProjects: 7, totalFunding: 500000, studentsImpacted: 300 },
    isActive: true, isVerified: true
  },
  {
    name: 'Jharkhand Medical Supplies Corporation',
    type: 'government_agency',
    sector: 'Healthcare',
    description: 'Government agency managing medical supplies and healthcare innovation',
    location: { city: 'Ranchi', state: 'Jharkhand' },
    contact: { email: 'jmsc@jharkhand.gov.in' },
    capabilities: { canMentor: false, canFund: true, canCoDevelop: false, canPilot: true, canProvideInfrastructure: false },
    fundingCapacity: '25L_to_1Cr',
    stats: { totalCollaborations: 4, activeCollaborations: 1, completedProjects: 3, totalFunding: 1500000, studentsImpacted: 50 },
    isActive: true, isVerified: true
  }
];

const CHALLENGES_DATA = [
  {
    title: 'Lack of Safe Drinking Water in Remote Tribal Villages of Khunti District',
    description: 'Over 15 remote tribal villages in Khunti district face severe shortage of safe drinking water. Borewells have gone dry due to falling groundwater table, and the river water is contaminated with fluoride and arsenic. Children and elderly are most affected, with reported cases of fluorosis in the community. The problem is particularly acute during summer months (March-June). Community members walk 3-4 km daily to fetch water from the nearest source. A sustainable, cost-effective solution that can work without continuous electricity supply is urgently needed. Rainwater harvesting and solar-powered purification systems could be part of the solution.',
    category: 'Water Management',
    priority: 'urgent',
    status: 'resolved',
    location: { address: 'Murhu Block', village: 'Murhu', block: 'Murhu', district: 'Khunti', pincode: '835210', coordinates: { lat: 23.1, lng: 85.3 } },
    tags: ['drinking water', 'tribal', 'fluoride', 'borewell', 'water quality'],
    aiSuggestedCategory: 'Water Management',
    aiConfidenceScore: 0.92
  },
  {
    title: 'Digital Learning Infrastructure Gap in Girish Block Government Schools',
    description: 'Government schools in Giridih block lack basic digital infrastructure for education. With the shift towards digital learning post-COVID, students in these schools are being left behind. Schools have no computers, no internet connectivity, and teachers lack digital literacy skills. Students preparing for competitive examinations find themselves at a severe disadvantage compared to urban counterparts. Over 8,000 students across 45 schools are affected. The solution needs to consider limited electricity supply, low bandwidth rural internet, and the need for content in Hindi and local tribal languages. Offline digital learning systems or low-power educational devices could be explored.',
    category: 'Education',
    priority: 'high',
    status: 'in_progress',
    location: { address: 'Giridih Block', block: 'Giridih', district: 'Giridih', pincode: '825301' },
    tags: ['digital learning', 'school', 'internet', 'tribal language', 'education'],
    aiSuggestedCategory: 'Education',
    aiConfidenceScore: 0.88
  },
  {
    title: 'Inefficient Traditional Paddy Cultivation Leading to Low Yields in Palamu Division',
    description: 'Farmers in Palamu division continue using traditional paddy cultivation methods resulting in yield of only 1.2 tonnes per hectare compared to national average of 3.5 tonnes. The region has erratic monsoon and poor irrigation infrastructure. Farmers lack access to quality seeds, proper fertilization guidance, and modern sowing techniques like System of Rice Intensification (SRI). Additionally, post-harvest losses are estimated at 25-30% due to lack of proper storage and processing facilities. An integrated solution combining improved farming practices, weather-based advisory systems, and community storage infrastructure is needed.',
    category: 'Agriculture',
    priority: 'high',
    status: 'assigned',
    location: { block: 'Palamu', district: 'Palamu', pincode: '822101' },
    tags: ['paddy', 'farming', 'yield', 'SRI', 'post-harvest', 'irrigation'],
    aiSuggestedCategory: 'Agriculture',
    aiConfidenceScore: 0.87
  },
  {
    title: 'Open Defecation Continues in Peri-Urban Areas Despite Swachh Bharat Facilities',
    description: 'Despite construction of over 2,000 individual household toilets under Swachh Bharat Mission in peri-urban areas of Dhanbad, open defecation has not stopped. Issues include: 1) Non-functional toilets due to lack of water supply, 2) Cultural resistance and behavioral change challenges, 3) Poorly constructed toilets with leaking pits that overflow during monsoon, 4) No proper maintenance mechanism. The problem creates serious public health risks with increased diarrheal diseases especially among children under 5. A community-led total sanitation approach with technical solutions for toilet maintenance and behavior change communication is required.',
    category: 'Sanitation & Environment',
    priority: 'high',
    status: 'validated',
    location: { address: 'Peri-urban Dhanbad', district: 'Dhanbad', pincode: '826001' },
    tags: ['sanitation', 'toilet', 'swachh bharat', 'open defecation', 'public health'],
    aiSuggestedCategory: 'Sanitation & Environment',
    aiConfidenceScore: 0.91
  },
  {
    title: 'Lack of Rehabilitation Services for Persons with Disabilities in Rural Jharkhand',
    description: 'An estimated 2.3 lakh persons with disabilities in rural Jharkhand have no access to rehabilitation services, assistive devices, or skill development opportunities. District hospitals have no rehabilitation centers and visiting therapists are rare. Custom assistive devices are unaffordable for BPL families. Remote villages are physically inaccessible for wheelchairs. Digital platforms for disability certification (UDID) are difficult to use without digital literacy. A comprehensive, affordable, and accessible rehabilitation ecosystem using low-cost assistive technology, community health workers, and digital outreach is needed.',
    category: 'Accessibility',
    priority: 'high',
    status: 'submitted',
    location: { district: 'Gumla', state: 'Jharkhand' },
    tags: ['disability', 'rehabilitation', 'assistive technology', 'UDID', 'rural', 'accessibility'],
    aiSuggestedCategory: 'Accessibility',
    aiConfidenceScore: 0.85
  },
  {
    title: 'Malnutrition Among Tribal Children in Simdega District Needs Urgent Intervention',
    description: 'Child malnutrition rates in Simdega district remain critically high with 48% of children under 5 suffering from stunting and 39% from wasting according to the latest NFHS data. Anganwadi centers lack proper nutritional supplements and qualified staff. Traditional knowledge about local nutritious foods is being lost. Mothers lack awareness about complementary feeding practices. Iron deficiency anemia affects 72% of adolescent girls. An innovative solution combining local food systems, fortification technology, and community-based monitoring using mobile technology is urgently needed to address this crisis.',
    category: 'Healthcare',
    priority: 'urgent',
    status: 'under_review',
    location: { district: 'Simdega', state: 'Jharkhand' },
    tags: ['malnutrition', 'child', 'anemia', 'anganwadi', 'tribal', 'nutrition'],
    aiSuggestedCategory: 'Healthcare',
    aiConfidenceScore: 0.90
  },
  {
    title: 'Forest-Dependent Communities Losing Livelihoods as Forest Cover Depletes',
    description: 'Over 50,000 forest-dependent tribal families in West Singhbhum district are losing their traditional livelihoods due to depletion of forest resources. Income from minor forest produce (MFP) has fallen by 60% in the last decade. Van Dhan scheme is not being effectively implemented at village level. Families are forced to migrate to cities for construction labor. A multi-pronged solution that can sustainably manage forest resources while creating alternative livelihood opportunities through agro-forestry, eco-tourism, and traditional craft revival is needed.',
    category: 'Rural Livelihoods',
    priority: 'high',
    status: 'testing',
    location: { district: 'West Singhbhum', state: 'Jharkhand' },
    tags: ['livelihood', 'tribal', 'forest', 'van dhan', 'migration', 'MFP'],
    aiSuggestedCategory: 'Rural Livelihoods',
    aiConfidenceScore: 0.83
  },
  {
    title: 'Smart Waste Management System Required for Ranchi Smart City',
    description: 'Ranchi generates over 650 tonnes of solid waste daily but only 45% is properly collected and processed. Existing landfill at Jhiri is overflowing. Wet and dry waste segregation at source is minimal. Informal waste pickers lack recognition and work in hazardous conditions. The city lacks real-time monitoring of garbage collection vehicles. A technology-enabled waste management system with IoT-based bin monitoring, optimized collection routes, waste-to-energy processing, and formal integration of waste pickers into the value chain is needed for Ranchi\'s smart city aspirations.',
    category: 'Urban Infrastructure',
    priority: 'medium',
    status: 'submitted',
    location: { district: 'Ranchi', state: 'Jharkhand' },
    tags: ['waste management', 'smart city', 'IoT', 'solid waste', 'landfill', 'recycling'],
    aiSuggestedCategory: 'Urban Infrastructure',
    aiConfidenceScore: 0.86
  },
  {
    title: 'Bureaucratic Delays in Issuance of Caste and Income Certificates Harassing Citizens',
    description: 'Citizens in rural Jharkhand face severe harassment and delays in obtaining caste certificates, income certificates, and domicile certificates from Block Development Offices. Average waiting time is 45-90 days despite official target of 7 days. Applicants are forced to make 5-8 trips to government offices. Middlemen exploit the situation demanding ₹500-2000 for certificate facilitation. Digital service portals exist but are non-functional in 80% of blocks due to poor connectivity and staff training. A simple, offline-compatible digital solution with proper escalation mechanism and monitoring dashboard is urgently needed.',
    category: 'Public Administration',
    priority: 'high',
    status: 'assigned',
    location: { district: 'Hazaribagh', state: 'Jharkhand' },
    tags: ['certificate', 'bureaucracy', 'e-governance', 'caste certificate', 'BDO', 'corruption'],
    aiSuggestedCategory: 'Public Administration',
    aiConfidenceScore: 0.89
  },
  {
    title: 'No Solar Energy Access for Off-Grid Villages in Latehar District',
    description: 'Over 200 villages in Latehar district remain off-grid with no reliable electricity supply. Diesel generators are economically unsustainable. The hilly terrain and dense forests make grid extension difficult and expensive. Local markets close by sunset impacting economic activity. Medical facilities cannot operate after dark. Children cannot study after sunset. Solar microgrids have been attempted but failed due to poor maintenance and lack of local technical expertise. A community-managed solar energy model with local technician training, appropriate business model and remote monitoring capability is needed.',
    category: 'Energy & Technology',
    priority: 'high',
    status: 'in_progress',
    location: { district: 'Latehar', state: 'Jharkhand' },
    tags: ['solar', 'electricity', 'off-grid', 'microgrid', 'renewable energy', 'village'],
    aiSuggestedCategory: 'Energy & Technology',
    aiConfidenceScore: 0.91
  }
];

const USERS_DATA = [
  { name: 'Dr. Admin Kumar', email: 'admin@innovatesphere.in', password: 'admin123', role: 'admin', phone: '9431100001', aadhaar: '9999-8888-7777', isVerified: true, isActive: true },
  { name: 'Amit Verma', email: 'amit@gmail.com', password: 'citizen123', role: 'citizen', citizenId: 'C1092', phone: '9431100002', aadhaar: '9182-4729-1092', isVerified: true, isActive: true, address: { street: 'Doranda', city: 'Ranchi', district: 'Ranchi', pincode: '834002' } },
  { name: 'Rajesh Mahto', email: 'rajesh@gmail.com', password: 'citizen123', role: 'citizen', citizenId: 'C4819', phone: '9431100003', aadhaar: '8492-3840-4819', isVerified: true, isActive: true, address: { city: 'Dhanbad', district: 'Dhanbad', pincode: '826001' } },
  { name: 'Sunita Oraon', email: 'sunita@gmail.com', password: 'citizen123', role: 'citizen', citizenId: 'C3918', phone: '9431100004', aadhaar: '7391-4920-3918', isVerified: false, isActive: true, address: { village: 'Murhu', district: 'Khunti', pincode: '835210' } },
  { name: 'Prof. Rajesh Singh', email: 'rajesh@iitjharkhand.ac.in', password: 'univ123', role: 'university_rep', phone: '9431100005', aadhaar: '6281-9301-8392', isVerified: true, isActive: true, designation: 'Professor & Research Coordinator', department: 'Environmental Engineering' },
  { name: 'Dr. Meena Prasad', email: 'meena@nitjsr.ac.in', password: 'univ123', role: 'university_rep', phone: '9431100006', aadhaar: '5192-8401-7392', isVerified: true, isActive: true, designation: 'Associate Professor', department: 'Civil Engineering' },
  { name: 'Vikram Sinha', email: 'tata@steel.com', password: 'industry123', role: 'industry_rep', phone: '9431100007', aadhaar: '4091-8291-6281', isVerified: true, isActive: true, designation: 'CSR Director' },
  { name: 'Anita Gupta', email: 'anita@jharkhandstartup.in', password: 'industry123', role: 'industry_rep', phone: '9431100008', aadhaar: '3981-7291-5192', isVerified: true, isActive: true, designation: 'Program Manager' },
  { name: 'Arun Kumar', email: 'arun@gmail.com', password: 'citizen123', role: 'citizen', citizenId: 'C4081', phone: '9431100009', aadhaar: '2871-6182-4081', isVerified: true, isActive: true, address: { city: 'Jamshedpur', district: 'East Singhbhum' } },
  { name: 'Kavya Sharma', email: 'kavya@gmail.com', password: 'citizen123', role: 'citizen', citizenId: 'C3972', phone: '9431100010', aadhaar: '1762-5071-3972', isVerified: true, isActive: true, address: { city: 'Bokaro', district: 'Bokaro' } }
];

async function seedDatabase() {
  try {
    console.log('\n🌱 Starting InnovateSphere seed process...\n');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Challenge.deleteMany({}),
      University.deleteMany({}),
      IndustryPartner.deleteMany({}),
      Notification.deleteMany({}),
      ActivityLog.deleteMany({})
    ]);
    console.log('✅ Data cleared');

    // Create Universities
    console.log('🏛️  Seeding universities...');
    const universities = await University.insertMany(UNIVERSITIES_DATA);
    console.log(`✅ Created ${universities.length} universities`);

    // Create Industry Partners
    console.log('🏭 Seeding industry partners...');
    const industryPartners = await IndustryPartner.insertMany(INDUSTRY_PARTNERS_DATA);
    console.log(`✅ Created ${industryPartners.length} industry partners`);

    // Create Users (with hashed passwords via model pre-save)
    console.log('👥 Seeding users...');
    const users = [];
    for (let i = 0; i < USERS_DATA.length; i++) {
      const userData = { ...USERS_DATA[i] };
      if (i === 4) userData.universityId = universities[0]._id; // IIT ISM
      if (i === 5) userData.universityId = universities[1]._id; // NIT JSR
      if (i === 6) userData.industryPartnerId = industryPartners[0]._id; // Tata Steel
      if (i === 7) userData.industryPartnerId = industryPartners[1]._id; // Startup Hub

      const user = new User(userData);
      await user.save();
      users.push(user);
    }
    console.log(`✅ Created ${users.length} users`);

    // Update universities with representatives
    await University.findByIdAndUpdate(universities[0]._id, { $push: { representatives: users[4]._id }, primaryContact: users[4]._id });
    await University.findByIdAndUpdate(universities[1]._id, { $push: { representatives: users[5]._id }, primaryContact: users[5]._id });
    await IndustryPartner.findByIdAndUpdate(industryPartners[0]._id, { $push: { representatives: users[6]._id } });
    await IndustryPartner.findByIdAndUpdate(industryPartners[1]._id, { $push: { representatives: users[7]._id } });

    // Create Challenges
    console.log('📋 Seeding challenges...');
    const citizens = users.filter(u => u.role === 'citizen');
    const challenges = [];

    for (let i = 0; i < CHALLENGES_DATA.length; i++) {
      const challengeData = {
        ...CHALLENGES_DATA[i],
        submittedBy: citizens[i % citizens.length]._id,
        submitterContact: {
          name: citizens[i % citizens.length].name,
          email: citizens[i % citizens.length].email,
          phone: citizens[i % citizens.length].phone
        },
        statusHistory: [{ status: 'submitted', changedBy: citizens[i % citizens.length]._id, note: 'Challenge submitted' }]
      };

      // Assign to university for relevant statuses
      if (['assigned', 'in_progress', 'testing', 'resolved'].includes(challengeData.status)) {
        challengeData.assignedUniversity = universities[i % universities.length]._id;
        challengeData.assignedAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
        challengeData.assignedBy = users[0]._id;
        challengeData.deadline = new Date(Date.now() + (30 + Math.random() * 60) * 24 * 60 * 60 * 1000);
      }

      if (challengeData.status === 'resolved') {
        challengeData.resolvedAt = new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000);
        challengeData.feedback = {
          rating: Math.floor(4 + Math.random()),
          review: 'Excellent work by the university team. Problem resolved effectively.',
          submittedAt: new Date(),
          submittedBy: citizens[0]._id
        };
        challengeData.isFeatured = true;
      }

      // Add milestones for in-progress
      if (['in_progress', 'testing', 'resolved'].includes(challengeData.status)) {
        challengeData.milestones = [
          { title: 'Problem Analysis & Site Survey', description: 'Detailed field study and data collection', deadline: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), completedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), status: 'completed' },
          { title: 'Solution Design & Prototype', description: 'Design the solution and build working prototype', deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), status: challengeData.status === 'resolved' ? 'completed' : 'in_progress' },
          { title: 'Pilot Implementation', description: 'Deploy solution in pilot community', deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), status: 'pending' }
        ];
      }

      const challenge = await Challenge.create(challengeData);
      challenges.push(challenge);
    }

    // Add more challenges with India-wide spread and realistic data for charts and maps
    const additionalChallenges = [];
    const categories = ['Education', 'Healthcare', 'Agriculture', 'Water Management', 'Sanitation & Environment', 'Rural Livelihoods', 'Urban Infrastructure', 'Energy & Technology', 'Accessibility', 'Public Administration'];
    const statuses = ['submitted', 'under_review', 'validated', 'assigned', 'in_progress', 'resolved', 'testing'];
    const indianProblemTemplates = [
      'Poor access to quality education in rural areas of',
      'Inadequate healthcare infrastructure and shortage of doctors in',
      'Crop failure and lack of modern farming techniques affecting farmers in',
      'Acute water shortage and contamination crisis in',
      'Open defecation and lack of sanitation facilities in villages of',
      'Unemployment and lack of skill development opportunities in',
      'Crumbling road and bridge infrastructure in',
      'Power outages and lack of reliable electricity supply in',
      'Inaccessible public spaces and transport for disabled persons in',
      'Corruption and delays in government service delivery in',
      'Flood damage and lack of disaster preparedness in',
      'Air and water pollution from industrial areas near',
      'Child malnutrition and anemia affecting tribal communities in',
      'Lack of cold storage for agricultural produce causing losses in',
      'Digital divide and lack of internet connectivity in'
    ];

    for (let i = 0; i < 60; i++) {
      const daysAgo = Math.floor(Math.random() * 270);
      const cat = categories[i % categories.length];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const loc = ALL_INDIA_LOCATIONS[i % ALL_INDIA_LOCATIONS.length];
      const templateIdx = i % indianProblemTemplates.length;
      const supportCount = Math.floor(Math.random() * 250);
      const commentCount = Math.floor(Math.random() * 80);

      const c = await Challenge.create({
        title: `${indianProblemTemplates[templateIdx]} ${loc.city} - Urgent Innovation Needed`,
        description: `This is a critical societal challenge affecting the residents of ${loc.city}, ${loc.district} district, ${loc.state}. The community has been facing this ${cat.toLowerCase()} challenge for several years without adequate intervention. This issue affects an estimated ${(Math.random() * 50000 + 5000).toFixed(0)} people in the region. Multiple government schemes have been attempted but implementation gaps remain. Universities and industry partners are urged to propose innovative, sustainable solutions that can be scaled across similar communities in India. The problem requires interdisciplinary approaches combining technology, social science, and public policy. Immediate action is needed to prevent further deterioration of living standards and economic opportunities for affected citizens.`,
        category: cat,
        priority: ['low', 'medium', 'high', 'urgent'][Math.floor(Math.random() * 4)],
        status,
        submittedBy: citizens[i % citizens.length]._id,
        location: {
          district: loc.district,
          state: loc.state,
          address: loc.city,
          coordinates: { lat: loc.lat + (Math.random() - 0.5) * 0.5, lng: loc.lng + (Math.random() - 0.5) * 0.5 }
        },
        submitterContact: { name: citizens[i % citizens.length].name, email: citizens[i % citizens.length].email },
        assignedUniversity: ['assigned', 'in_progress', 'resolved', 'testing'].includes(status) ? universities[i % universities.length]._id : undefined,
        resolvedAt: status === 'resolved' ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : undefined,
        createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        statusHistory: [{ status: 'submitted', changedBy: citizens[i % citizens.length]._id }],
        aiSuggestedCategory: cat,
        aiConfidenceScore: parseFloat((0.75 + Math.random() * 0.2).toFixed(2)),
        supportCount,
        supports: supportCount > 0 ? [citizens[0]._id] : [],
        commentCount,
        isFeatured: i < 8,
        viewCount: Math.floor(Math.random() * 2000)
      });
      additionalChallenges.push(c);
    }

    console.log(`✅ Created ${challenges.length + additionalChallenges.length} challenges`);

    // Create Notifications
    console.log('🔔 Seeding notifications...');
    const notifications = [];
    for (const user of users) {
      if (user.role === 'citizen') {
        notifications.push({
          recipient: user._id,
          type: 'welcome',
          title: 'Welcome to InnovateSphere!',
          message: 'Thank you for joining InnovateSphere. Start making a difference by submitting a societal challenge.',
          priority: 'normal',
          isRead: false
        });
        notifications.push({
          recipient: user._id,
          type: 'challenge_submitted',
          title: 'Challenge Submitted Successfully',
          message: 'Your challenge has been received and is under review. You will be notified of updates.',
          priority: 'normal',
          isRead: true,
          readAt: new Date()
        });
      }
      if (user.role === 'university_rep') {
        notifications.push({
          recipient: user._id,
          type: 'challenge_assigned',
          title: 'New Challenge Assigned',
          message: 'A new societal challenge has been assigned to your university for solution development.',
          priority: 'high',
          isRead: false
        });
      }
    }
    await Notification.insertMany(notifications);
    console.log(`✅ Created ${notifications.length} notifications`);

    // Create sample comments
    console.log('💬 Seeding comments...');
    const allChallenges = [...challenges, ...additionalChallenges];
    const sampleComments = [
      'This is a critical issue. Our community has been suffering for years.',
      'Great initiative! The university should prioritize this problem.',
      'I support this challenge. The government needs to take immediate action.',
      'As a student researcher, I would love to work on this problem.',
      'Industry should also come forward to fund solutions for this.',
      'This affects thousands of families. Urgent attention needed.',
      'Similar issues exist in our district too. A scalable solution is needed.',
      'The local administration has failed to address this for years.'
    ];
    const commentDocs = [];
    for (let i = 0; i < Math.min(30, allChallenges.length); i++) {
      const numComments = Math.floor(Math.random() * 4) + 1;
      for (let j = 0; j < numComments; j++) {
        commentDocs.push({
          challenge: allChallenges[i]._id,
          author: citizens[j % citizens.length]._id,
          text: sampleComments[(i + j) % sampleComments.length],
          createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000)
        });
      }
    }
    if (commentDocs.length > 0) await Comment.insertMany(commentDocs);
    console.log(`✅ Created ${commentDocs.length} comments`);

    // Create Activity Logs
    console.log('📝 Seeding activity logs...');
    const logs = [];
    for (const user of users) {
      logs.push({
        actor: user._id,
        actorName: user.name,
        actorRole: user.role,
        action: 'user_registered',
        target: { type: 'User', id: user._id, name: user.name },
        description: `${user.name} registered as ${user.role}`,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      });
    }
    for (const challenge of challenges.slice(0, 5)) {
      logs.push({
        actor: users[0]._id,
        actorName: users[0].name,
        actorRole: 'admin',
        action: 'challenge_status_changed',
        target: { type: 'Challenge', id: challenge._id, name: challenge.title },
        description: `Challenge status updated to ${challenge.status}`,
        createdAt: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000)
      });
    }
    await ActivityLog.insertMany(logs);
    console.log(`✅ Created ${logs.length} activity logs`);

    console.log('\n✨ ====================================');
    console.log('   InnovateSphere Seed Complete!');
    console.log('====================================');
    console.log('\n📊 Summary:');
    console.log(`   👤 Users:              ${users.length}`);
    console.log(`   🏛️  Universities:       ${universities.length}`);
    console.log(`   🏭 Industry Partners:  ${industryPartners.length}`);
    console.log(`   📋 Challenges:         ${challenges.length + additionalChallenges.length}`);
    console.log(`   🔔 Notifications:      ${notifications.length}`);
    console.log('\n🔐 Login Credentials:');
    console.log('   Admin:       admin@innovatesphere.in  / admin123');
    console.log('   Citizen:     rajesh@gmail.com        / citizen123');
    console.log('   University:  rajesh@iitjharkhand.ac.in / univ123');
    console.log('   Industry:    tata@steel.com           / industry123');
    console.log('\n🚀 Run: npm run dev');
    console.log('🌐 Open: http://localhost:5000\n');

    await mongoose.connection.close();
  } catch (error) {
    console.error('\n❌ Seed Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seedDatabase();
