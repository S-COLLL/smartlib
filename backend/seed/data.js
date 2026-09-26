// Demo data for SmartLib. Prices in Indian Rupees (₹).

const categories = [
  { name: 'Fiction', icon: '📖', description: 'Novels, stories and literary fiction', subcategories: ['Indian Fiction', 'Mythology', 'Classics', 'Contemporary'] },
  { name: 'Science', icon: '🔬', description: 'Physics, biology, astronomy and popular science', subcategories: ['Physics', 'Biology', 'Astronomy'] },
  { name: 'Technology', icon: '💡', description: 'Technology, innovation and artificial intelligence', subcategories: ['AI', 'Innovation'] },
  { name: 'Programming', icon: '💻', description: 'Software development and computer science', subcategories: ['Algorithms', 'Web Development', 'Software Craft', 'C Programming'] },
  { name: 'Engineering', icon: '⚙️', description: 'Core engineering textbooks', subcategories: ['Electrical', 'Mechanical', 'Civil'] },
  { name: 'Mathematics', icon: '📐', description: 'Pure and applied mathematics', subcategories: ['Engineering Maths', 'School Maths'] },
  { name: 'History', icon: '🏛️', description: 'Indian and world history', subcategories: ['Modern India', 'World History'] },
  { name: 'Biography', icon: '👤', description: 'Biographies, autobiographies and memoirs', subcategories: ['Autobiography', 'Biography'] },
  { name: 'Business', icon: '📈', description: 'Finance, management and economics', subcategories: ['Personal Finance', 'Management'] },
  { name: 'Entrepreneurship', icon: '🚀', description: 'Startups and building companies', subcategories: ['Startups'] },
  { name: 'Competitive Exams', icon: '🎯', description: 'UPSC, GATE, CAT and aptitude preparation', subcategories: ['UPSC', 'Aptitude'] },
  { name: 'Reference', icon: '📚', description: 'Dictionaries, encyclopedias and handbooks', subcategories: ['Dictionary'] },
];

const authors = [
  { name: 'Paulo Coelho', country: 'Brazil', biography: 'Brazilian lyricist and novelist, best known for The Alchemist, one of the best-selling books in history.' },
  { name: 'Chetan Bhagat', country: 'India', biography: 'Indian author and columnist, an IIT Delhi and IIM Ahmedabad alumnus whose novels about young India became bestsellers.' },
  { name: 'R.K. Narayan', country: 'India', biography: 'One of the leading Indian writers in English, creator of the fictional town of Malgudi.' },
  { name: 'Amish Tripathi', country: 'India', biography: 'Indian author known for the Shiva Trilogy and Ram Chandra series of mythological fiction.' },
  { name: 'Arundhati Roy', country: 'India', biography: 'Indian author and activist who won the Booker Prize in 1997 for The God of Small Things.' },
  { name: 'Munshi Premchand', country: 'India', biography: 'Pioneer of modern Hindi and Urdu literature, author of Godaan and hundreds of short stories.' },
  { name: 'Stephen Hawking', country: 'United Kingdom', biography: 'Theoretical physicist and cosmologist, author of A Brief History of Time.' },
  { name: 'Carl Sagan', country: 'United States', biography: 'Astronomer, planetary scientist and science communicator, creator of Cosmos.' },
  { name: 'Richard Dawkins', country: 'United Kingdom', biography: 'Evolutionary biologist who popularised the gene-centred view of evolution.' },
  { name: 'H.C. Verma', country: 'India', biography: 'Indian physicist and former IIT Kanpur professor, author of Concepts of Physics.' },
  { name: 'Walter Isaacson', country: 'United States', biography: 'Journalist and biographer of Steve Jobs, Einstein, Leonardo da Vinci and others.' },
  { name: 'Max Tegmark', country: 'Sweden', biography: 'MIT physicist and AI researcher, co-founder of the Future of Life Institute.' },
  { name: 'Kai-Fu Lee', country: 'Taiwan', biography: 'Computer scientist, venture capitalist and former president of Google China.' },
  { name: 'Robert C. Martin', country: 'United States', biography: '"Uncle Bob", software engineer and author known for promoting clean code and SOLID principles.' },
  { name: 'Andrew Hunt', country: 'United States', biography: 'Co-author of The Pragmatic Programmer and co-author of the Agile Manifesto.' },
  { name: 'Thomas H. Cormen', country: 'United States', biography: 'Computer scientist at Dartmouth College, lead author of Introduction to Algorithms (CLRS).' },
  { name: 'Marijn Haverbeke', country: 'Netherlands', biography: 'Programmer and author of Eloquent JavaScript and the CodeMirror editor.' },
  { name: 'Yashavant Kanetkar', country: 'India', biography: 'Indian computer science author whose Let Us C has taught generations of programmers.' },
  { name: 'D.P. Kothari', country: 'India', biography: 'Former Director of IIT Delhi and author of widely used electrical engineering textbooks.' },
  { name: 'R.K. Bansal', country: 'India', biography: 'Author of standard Indian engineering textbooks on strength of materials and fluid mechanics.' },
  { name: 'B.S. Grewal', country: 'India', biography: 'Author of Higher Engineering Mathematics, a staple of Indian engineering curricula.' },
  { name: 'R.D. Sharma', country: 'India', biography: 'Mathematics educator and author of popular school mathematics textbooks.' },
  { name: 'Ramachandra Guha', country: 'India', biography: 'Historian and biographer whose works focus on modern Indian history.' },
  { name: 'Jawaharlal Nehru', country: 'India', biography: 'First Prime Minister of India, statesman and author.' },
  { name: 'Yuval Noah Harari', country: 'Israel', biography: 'Historian and professor at the Hebrew University of Jerusalem, author of Sapiens.' },
  { name: 'A.P.J. Abdul Kalam', country: 'India', biography: 'Aerospace scientist and the 11th President of India, known as the Missile Man of India.' },
  { name: 'M.K. Gandhi', country: 'India', biography: 'Leader of the Indian independence movement and proponent of non-violent resistance.' },
  { name: 'Robert T. Kiyosaki', country: 'United States', biography: 'Businessman and author of the personal finance classic Rich Dad Poor Dad.' },
  { name: 'Morgan Housel', country: 'United States', biography: 'Partner at The Collaborative Fund and author of The Psychology of Money.' },
  { name: 'Peter Thiel', country: 'United States', biography: 'Entrepreneur and investor, co-founder of PayPal and Palantir.' },
  { name: 'Eric Ries', country: 'United States', biography: 'Entrepreneur and creator of the Lean Startup methodology.' },
  { name: 'M. Laxmikanth', country: 'India', biography: 'Author of Indian Polity, the standard reference for civil services aspirants.' },
  { name: 'R.S. Aggarwal', country: 'India', biography: 'Author of numerous books on quantitative aptitude and reasoning for competitive exams.' },
  { name: 'A.S. Hornby', country: 'United Kingdom', biography: 'English grammarian and lexicographer who created the Oxford Advanced Learner\'s Dictionary.' },
];

// [title, author, isbn, publisher, year, category, subcategory, price, pages, language, quantity, shelf, edition, description, popularity]
const books = [
  ['The Alchemist', 'Paulo Coelho', '9780062315007', 'HarperOne', 1988, 'Fiction', 'Classics', 399, 208, 'English', 6, 'A', '25th Anniversary', 'A shepherd boy named Santiago travels from Spain to the Egyptian desert in search of treasure and discovers the importance of following his dreams.', 34],
  ['Five Point Someone', 'Chetan Bhagat', '9788129104595', 'Rupa Publications', 2004, 'Fiction', 'Contemporary', 176, 270, 'English', 5, 'A', '1st', 'Three friends struggle with the grading system at IIT in this funny and moving campus novel.', 22],
  ['2 States', 'Chetan Bhagat', '9788129115300', 'Rupa Publications', 2009, 'Fiction', 'Contemporary', 195, 269, 'English', 5, 'A', '1st', 'A Punjabi boy and a Tamilian girl try to convince their families to agree to their marriage.', 26],
  ['Half Girlfriend', 'Chetan Bhagat', '9788129135728', 'Rupa Publications', 2014, 'Fiction', 'Contemporary', 176, 260, 'English', 4, 'A', '1st', 'Madhav, a boy from Bihar, falls for Riya, a rich Delhi girl, at St. Stephen\'s College.', 15],
  ['Malgudi Days', 'R.K. Narayan', '9780143039655', 'Penguin Classics', 1943, 'Fiction', 'Indian Fiction', 299, 256, 'English', 4, 'B', 'Reprint', 'A collection of short stories set in the fictional South Indian town of Malgudi.', 18],
  ['The Guide', 'R.K. Narayan', '9780143039648', 'Penguin Classics', 1958, 'Fiction', 'Indian Fiction', 250, 220, 'English', 2, 'B', 'Reprint', 'Raju, a tour guide turned spiritual guide, is mistaken for a holy man in a drought-stricken village.', 12],
  ['The Immortals of Meluha', 'Amish Tripathi', '9789380658742', 'Westland', 2010, 'Fiction', 'Mythology', 350, 390, 'English', 5, 'B', '1st', 'The first book of the Shiva Trilogy reimagines Lord Shiva as a Tibetan tribal chief.', 20],
  ['The God of Small Things', 'Arundhati Roy', '9780679457312', 'Random House', 1997, 'Fiction', 'Indian Fiction', 450, 340, 'English', 3, 'B', '1st', 'Twins Estha and Rahel grow up in Kerala amid family secrets and forbidden love. Booker Prize 1997.', 9],
  ['Godaan', 'Munshi Premchand', '9788171826001', 'Rajkamal Prakashan', 1936, 'Fiction', 'Classics', 220, 330, 'Hindi', 3, 'B', 'Reprint', 'The story of Hori, a poor farmer, and his lifelong wish to own a cow — a landmark of Hindi literature.', 7],
  ['A Brief History of Time', 'Stephen Hawking', '9780553380163', 'Bantam', 1988, 'Science', 'Physics', 499, 212, 'English', 4, 'C', '10th Anniversary', 'From the Big Bang to black holes, Hawking explains the nature of space and time for general readers.', 19],
  ['Cosmos', 'Carl Sagan', '9780345539434', 'Ballantine Books', 1980, 'Science', 'Astronomy', 650, 396, 'English', 3, 'C', 'Reprint', 'A sweeping story of cosmic evolution and the development of science and civilisation.', 14],
  ['The Selfish Gene', 'Richard Dawkins', '9780198788607', 'Oxford University Press', 1976, 'Science', 'Biology', 599, 496, 'English', 3, 'D', '40th Anniversary', 'A gene-centred view of evolution that introduced the concept of the meme.', 8],
  ['Concepts of Physics Vol 1', 'H.C. Verma', '9788177091878', 'Bharati Bhawan', 1992, 'Science', 'Physics', 465, 450, 'English', 8, 'D', 'Revised', 'The standard physics text for JEE aspirants, building concepts from first principles.', 30],
  ['The Innovators', 'Walter Isaacson', '9781476708706', 'Simon & Schuster', 2014, 'Technology', 'Innovation', 799, 560, 'English', 3, 'E', '1st', 'How a group of hackers, geniuses and geeks created the digital revolution.', 6],
  ['Life 3.0', 'Max Tegmark', '9781101946596', 'Knopf', 2017, 'Technology', 'AI', 699, 364, 'English', 3, 'E', '1st', 'Being human in the age of artificial intelligence — what future do we want?', 4],
  ['AI Superpowers', 'Kai-Fu Lee', '9781328546395', 'Houghton Mifflin', 2018, 'Technology', 'AI', 599, 272, 'English', 3, 'F', '1st', 'China, Silicon Valley and the new world order shaped by artificial intelligence.', 3],
  ['Clean Code', 'Robert C. Martin', '9780132350884', 'Prentice Hall', 2008, 'Programming', 'Software Craft', 850, 464, 'English', 5, 'G', '1st', 'A handbook of agile software craftsmanship: how to write readable, maintainable code.', 25],
  ['The Pragmatic Programmer', 'Andrew Hunt', '9780135957059', 'Addison-Wesley', 2019, 'Programming', 'Software Craft', 950, 352, 'English', 4, 'G', '20th Anniversary', 'Your journey to mastery — timeless advice for software developers.', 13],
  ['Introduction to Algorithms', 'Thomas H. Cormen', '9780262046305', 'MIT Press', 2022, 'Programming', 'Algorithms', 1450, 1312, 'English', 6, 'G', '4th', 'The comprehensive algorithms textbook known as CLRS.', 28],
  ['Eloquent JavaScript', 'Marijn Haverbeke', '9781593279509', 'No Starch Press', 2018, 'Programming', 'Web Development', 720, 472, 'English', 4, 'H', '3rd', 'A modern introduction to programming with JavaScript.', 17],
  ['Let Us C', 'Yashavant Kanetkar', '9789388511391', 'BPB Publications', 2019, 'Programming', 'C Programming', 340, 548, 'English', 8, 'H', '16th', 'The classic introduction to C programming for Indian students.', 31],
  ['Basic Electrical Engineering', 'D.P. Kothari', '9789353166595', 'McGraw Hill', 2019, 'Engineering', 'Electrical', 595, 780, 'English', 5, 'I', '4th', 'Fundamentals of circuits, machines and power systems for first-year engineering.', 11],
  ['Strength of Materials', 'R.K. Bansal', '9788131808146', 'Laxmi Publications', 2010, 'Engineering', 'Mechanical', 695, 1100, 'English', 5, 'I', '6th', 'Stress, strain, bending and torsion explained with solved examples.', 10],
  ['Higher Engineering Mathematics', 'B.S. Grewal', '9788193328491', 'Khanna Publishers', 2017, 'Mathematics', 'Engineering Maths', 825, 1236, 'English', 6, 'J', '44th', 'The definitive engineering mathematics reference used across Indian universities.', 24],
  ['Mathematics for Class 12', 'R.D. Sharma', '9789383182442', 'Dhanpat Rai Publications', 2020, 'Mathematics', 'School Maths', 740, 1500, 'English', 5, 'J', '2020-21', 'CBSE Class 12 mathematics with thousands of solved problems.', 16],
  ['India After Gandhi', 'Ramachandra Guha', '9780060958589', 'Harper Perennial', 2007, 'History', 'Modern India', 699, 900, 'English', 3, 'K', '1st', 'The history of the world\'s largest democracy from independence to the present.', 9],
  ['The Discovery of India', 'Jawaharlal Nehru', '9780143031031', 'Penguin', 1946, 'History', 'Modern India', 450, 656, 'English', 3, 'K', 'Reprint', 'Written in Ahmednagar Fort prison, Nehru\'s sweeping account of Indian history and culture.', 7],
  ['Sapiens', 'Yuval Noah Harari', '9780062316097', 'Harper', 2015, 'History', 'World History', 599, 464, 'English', 5, 'K', '1st', 'A brief history of humankind from the Stone Age to the twenty-first century.', 27],
  ['Wings of Fire', 'A.P.J. Abdul Kalam', '9788173711466', 'Universities Press', 1999, 'Biography', 'Autobiography', 250, 196, 'English', 7, 'L', '1st', 'The autobiography of Dr. APJ Abdul Kalam, from Rameswaram to India\'s missile programme.', 33],
  ['Ignited Minds', 'A.P.J. Abdul Kalam', '9780143029823', 'Penguin', 2002, 'Biography', 'Autobiography', 299, 208, 'English', 3, 'L', '1st', 'Unleashing the power within India — Kalam\'s call to the youth of the nation.', 12],
  ['Steve Jobs', 'Walter Isaacson', '9781451648539', 'Simon & Schuster', 2011, 'Biography', 'Biography', 899, 656, 'English', 3, 'L', '1st', 'The exclusive biography of Apple\'s co-founder based on more than forty interviews.', 15],
  ['The Story of My Experiments with Truth', 'M.K. Gandhi', '9780807059098', 'Beacon Press', 1927, 'Biography', 'Autobiography', 199, 528, 'English', 4, 'L', 'Reprint', 'Mahatma Gandhi\'s autobiography, covering his life up to 1921.', 10],
  ['Rich Dad Poor Dad', 'Robert T. Kiyosaki', '9781612680194', 'Plata Publishing', 2017, 'Business', 'Personal Finance', 399, 336, 'English', 5, 'M', '20th Anniversary', 'What the rich teach their kids about money that the poor and middle class do not.', 23],
  ['The Psychology of Money', 'Morgan Housel', '9789390166268', 'Jaico Publishing', 2020, 'Business', 'Personal Finance', 399, 252, 'English', 6, 'M', '1st', 'Timeless lessons on wealth, greed and happiness.', 21],
  ['Zero to One', 'Peter Thiel', '9780804139298', 'Crown Business', 2014, 'Entrepreneurship', 'Startups', 499, 224, 'English', 2, 'N', '1st', 'Notes on startups, or how to build the future.', 14],
  ['The Lean Startup', 'Eric Ries', '9780307887894', 'Crown Business', 2011, 'Entrepreneurship', 'Startups', 550, 336, 'English', 3, 'N', '1st', 'How continuous innovation creates radically successful businesses.', 11],
  ['Indian Polity', 'M. Laxmikanth', '9789354600371', 'McGraw Hill', 2021, 'Competitive Exams', 'UPSC', 785, 1100, 'English', 8, 'O', '6th', 'The most trusted book on the Indian constitution and polity for civil services.', 29],
  ['Quantitative Aptitude for Competitive Examinations', 'R.S. Aggarwal', '9789352534029', 'S. Chand', 2017, 'Competitive Exams', 'Aptitude', 595, 900, 'English', 8, 'O', 'Revised', 'Arithmetic and data interpretation for bank, SSC, CAT and campus placements.', 5],
  ["Oxford Advanced Learner's Dictionary", 'A.S. Hornby', '9780194798792', 'Oxford University Press', 2020, 'Reference', 'Dictionary', 895, 1936, 'English', 4, 'P', '10th', 'The world\'s best-selling advanced learner\'s dictionary.', 2],
];

// Books added in the last 30 days (for "Books added recently")
const recentlyAdded = ['Life 3.0', 'AI Superpowers', 'Quantitative Aptitude for Competitive Examinations', "Oxford Advanced Learner's Dictionary", 'The God of Small Things'];

// [code, floor, section, racks, rowsPerRack, capacity, category]
const shelves = [
  ['A', 1, 'Fiction', 4, 5, 24, 'Fiction'],
  ['B', 1, 'Fiction', 4, 5, 30, 'Fiction'],
  ['C', 1, 'Science', 4, 4, 30, 'Science'],
  ['D', 1, 'Science', 3, 4, 12, 'Science'],
  ['E', 1, 'Technology', 3, 4, 25, 'Technology'],
  ['F', 1, 'Technology', 3, 4, 20, 'Technology'],
  ['G', 2, 'Programming', 4, 4, 15, 'Programming'],
  ['H', 2, 'Programming', 4, 4, 20, 'Programming'],
  ['I', 2, 'Engineering', 4, 4, 25, 'Engineering'],
  ['J', 2, 'Mathematics', 3, 4, 14, 'Mathematics'],
  ['K', 3, 'History', 4, 4, 20, 'History'],
  ['L', 3, 'Biography', 4, 4, 20, 'Biography'],
  ['M', 3, 'Business', 3, 4, 25, 'Business'],
  ['N', 3, 'Entrepreneurship', 3, 4, 15, 'Entrepreneurship'],
  ['O', 3, 'Competitive Exams', 4, 4, 20, 'Competitive Exams'],
  ['P', 3, 'Reference', 3, 4, 20, 'Reference'],
];

// [name, email, phone, department, course, year, type, startDaysAgo, expiryInDays, status]
const members = [
  ['Aarav Sharma', 'student@smartlib.com', '+91 98765 43210', 'Computer Science', 'B.Tech', '3rd Year', 'Student', 400, 330, 'Active'],
  ['Priya Patel', 'priya.patel@college.edu', '+91 98201 11223', 'Physics', 'B.Sc', '2nd Year', 'Student', 380, 350, 'Active'],
  ['Rohan Mehta', 'rohan.mehta@college.edu', '+91 99300 44556', 'Mechanical', 'B.Tech', '4th Year', 'Student', 700, 30, 'Active'],
  ['Ananya Iyer', 'ananya.iyer@college.edu', '+91 97654 32109', 'Management', 'MBA', '1st Year', 'Student', 200, 165, 'Active'],
  ['Vikram Singh', 'vikram.singh@college.edu', '+91 98110 22334', 'Computer Science', 'M.Tech', '2nd Year', 'Student', 500, 230, 'Active'],
  ['Sneha Reddy', 'sneha.reddy@college.edu', '+91 90000 12345', 'Electronics', 'B.Tech', '2nd Year', 'Student', 300, 60, 'Active'],
  ['Arjun Nair', 'arjun.nair@college.edu', '+91 94470 55667', 'Commerce', 'B.Com', '3rd Year', 'Student', 350, 15 + 100, 'Active'],
  ['Kavya Joshi', 'kavya.joshi@college.edu', '+91 98981 77889', 'Political Science', 'B.A', '3rd Year', 'Student', 330, 35, 'Active'],
  ['Dr. Rajesh Kumar', 'rajesh.kumar@college.edu', '+91 98450 99001', 'Computer Science', 'Faculty', 'Professor', 'Faculty', 900, 465, 'Active'],
  ['Meera Krishnan', 'meera.k@college.edu', '+91 96000 34567', 'Management', 'MBA', '2nd Year', 'Premium', 420, 310, 'Active'],
  ['Aditya Verma', 'aditya.verma@college.edu', '+91 93100 45678', 'Civil', 'B.Tech', '3rd Year', 'Student', 390, 340, 'Active'],
  ['Ishita Gupta', 'ishita.gupta@college.edu', '+91 98730 56789', 'History', 'M.A', '1st Year', 'Student', 250, 115, 'Active'],
  ['Karan Malhotra', 'karan.m@college.edu', '+91 98150 67890', 'Computer Science', 'BCA', '2nd Year', 'Student', 280, 85, 'Active'],
  ['Dr. Sunita Rao', 'sunita.rao@college.edu', '+91 94480 78901', 'Physics', 'Faculty', 'Associate Professor', 'Faculty', 1200, 530, 'Active'],
  ['Rahul Deshmukh', 'rahul.d@college.edu', '+91 97300 89012', 'Library', 'Staff', 'Assistant', 'Staff', 600, 130, 'Active'],
  ['Neha Kapoor', 'neha.kapoor@college.edu', '+91 98110 90123', 'Electronics', 'M.Tech', '1st Year', 'Student', 355, 9, 'Active'],
  ['Siddharth Jain', 'siddharth.jain@college.edu', '+91 99280 01234', 'Commerce', 'B.Com', 'Graduated', 'Student', 800, -40, 'Expired'],
  ['Pooja Bhatt', 'pooja.bhatt@college.edu', '+91 98250 13579', 'Mechanical', 'B.Tech', '1st Year', 'Guest', 120, 245, 'Suspended'],
];

// [memberIdx, bookTitle, issuedDaysAgo, returnedDaysAgo|null, condition]
const issues = [
  // Active, within due date
  [0, 'The Alchemist', 5, null],
  [0, 'Clean Code', 10, null],
  [1, 'The Guide', 3, null],
  [2, 'Cosmos', 8, null],
  [3, 'Zero to One', 2, null],
  [4, 'Introduction to Algorithms', 12, null],
  [5, 'Wings of Fire', 1, null],
  [6, 'Five Point Someone', 6, null],
  [7, 'Indian Polity', 4, null],
  // Active, overdue
  [8, 'The Guide', 20, null],
  [9, 'Cosmos', 25, null],
  [10, 'Zero to One', 19, null],
  [11, 'Sapiens', 30, null],
  [12, 'Let Us C', 17, null],
  [1, 'Concepts of Physics Vol 1', 22, null],
  // Returned on time
  [0, '2 States', 150, 140],
  [1, 'Malgudi Days', 140, 130],
  [2, 'Sapiens', 120, 112],
  [3, 'Clean Code', 110, 100],
  [4, 'The Alchemist', 95, 85],
  [5, 'Rich Dad Poor Dad', 80, 70],
  [6, 'Wings of Fire', 70, 60],
  [7, 'The Psychology of Money', 60, 50],
  [13, 'Eloquent JavaScript', 45, 35],
  [14, 'A Brief History of Time', 40, 30],
  [15, 'The Alchemist', 35, 25],
  [2, 'Wings of Fire', 28, 18],
  [0, 'The Immortals of Meluha', 50, 41],
  // Returned late (fines)
  [8, 'Introduction to Algorithms', 130, 109],
  [9, 'The Lean Startup', 100, 82],
  [10, 'Half Girlfriend', 75, 51],
  [11, 'Steve Jobs', 55, 36],
  [3, 'The Alchemist', 30, 9],
  [12, 'Indian Polity', 160, 138],
  // Lost and damaged
  [13, 'Half Girlfriend', 65, 45, 'Lost'],
  [14, 'Cosmos', 90, 75, 'Damaged'],
];

// How fines from late/lost/damaged returns were settled: keyed by "memberIdx|bookTitle|type"
// action: pay (amount, method, daysAfterReturn) | waive | discount
const fineSettlements = {
  '8|Introduction to Algorithms|Late Fine': { pay: [70, 'Cash', 0] },
  '9|The Lean Startup|Late Fine': { pay: [40, 'UPI', 1] },
  '10|Half Girlfriend|Late Fine': { pay: [50, 'Card', 0] },
  '11|Steve Jobs|Late Fine': { waive: 'First-time delay, medical reason' },
  '12|Indian Polity|Late Fine': { discount: 20, pay: [60, 'Cash', 0] },
  '13|Half Girlfriend|Late Fine': { pay: [60, 'UPI', 0] },
  '13|Half Girlfriend|Lost Book': { pay: [100, 'Bank Transfer', 2] },
  '14|Cosmos|Late Fine': { pay: [10, 'Cash', 0] },
  '14|Cosmos|Damage': { pay: [195, 'Card', 0] },
};

// [memberIdx, amount, method, daysAgo, status]
const membershipPayments = [
  [3, 500, 'UPI', 170, 'Paid'],
  [11, 500, 'Cash', 140, 'Paid'],
  [12, 500, 'Card', 110, 'Paid'],
  [17, 500, 'Cash', 100, 'Paid'],
  [9, 750, 'Bank Transfer', 20, 'Paid'],
  [15, 500, 'Bank Transfer', 1, 'Pending'],
];

// [memberIdx, bookTitle, daysAgo, status]
const reservations = [
  [13, 'The Guide', 5, 'Waiting'],
  [14, 'The Guide', 3, 'Waiting'],
  [6, 'Cosmos', 4, 'Waiting'],
  [7, 'Zero to One', 2, 'Waiting'],
  [5, 'Cosmos', 1, 'Waiting'],
  [4, 'Sapiens', 2, 'Available'],
  [0, 'Clean Code', 12, 'Collected'],
  [4, 'Introduction to Algorithms', 14, 'Collected'],
  [9, 'Steve Jobs', 40, 'Cancelled'],
  [12, 'Wings of Fire', 60, 'Expired'],
];

module.exports = { categories, authors, books, recentlyAdded, shelves, members, issues, fineSettlements, membershipPayments, reservations };
