import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiClock, FiUser, FiCalendar, FiShare2, FiArrowLeft, FiTag } from 'react-icons/fi';
import { FaFacebook, FaTwitter, FaLinkedin } from 'react-icons/fa';

function BlogPost() {
  const blogSections = [
    {
      heading: 'The Rise of Crypto in Real Estate',
      paragraphs: [
        'Cryptocurrency is increasingly being accepted in real estate transactions, offering several advantages:'
      ],
      items: [
        'Faster transaction processing',
        'Lower transaction fees',
        'Enhanced security through blockchain technology',
        'Access to global investment opportunities'
      ]
    },
    {
      heading: "Blockchain's Impact on Property Transactions",
      paragraphs: [
        'Blockchain technology is revolutionizing property transactions in several ways:'
      ],
      ordered: true,
      items: [
        'Smart Contracts: Automating and securing transaction processes',
        'Property Records: Creating immutable records of ownership',
        'Tokenization: Enabling fractional property ownership',
        'Transparency: Providing clear transaction histories'
      ]
    },
    {
      heading: 'The Future Outlook',
      paragraphs: [
        'As we look to the future, several trends are emerging:'
      ],
      items: [
        'Increased adoption of cryptocurrency payments in real estate',
        'More platforms offering tokenized property investments',
        'Integration of smart contracts in property transactions',
        'Enhanced security measures for digital real estate transactions'
      ]
    },
    {
      heading: 'Conclusion',
      paragraphs: [
        "The integration of cryptocurrency and blockchain in real estate is not just a trend; it is the future of property transactions. As these technologies continue to evolve, we can expect to see more innovative solutions that make real estate investment more accessible, secure, and efficient."
      ]
    }
  ];

  const post = {
    title: 'The Future of Real Estate: Cryptocurrency Payments and Blockchain Technology',
    image: '/placeholders/blog-card.svg',
    author: 'Sarah Johnson',
    date: '2024-03-15',
    readTime: '5 min read',
    category: 'Cryptocurrency',
    tags: ['Blockchain', 'Real Estate', 'Cryptocurrency', 'Investment']
  };

  return (
    <div className="min-h-screen bg-secondary-50">
      <div className="relative h-[400px]">
        <img
          src={post.image}
          alt={post.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
        <div className="absolute inset-0 flex items-center">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl text-white"
            >
              <Link to="/blog" className="inline-flex items-center text-white mb-6 hover:text-primary-300">
                <FiArrowLeft className="mr-2" />
                Back to Blog
              </Link>
              <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
              <div className="flex items-center text-secondary-200 space-x-6">
                <div className="flex items-center">
                  <FiUser className="mr-2" />
                  {post.author}
                </div>
                <div className="flex items-center">
                  <FiCalendar className="mr-2" />
                  {post.date}
                </div>
                <div className="flex items-center">
                  <FiClock className="mr-2" />
                  {post.readTime}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="container py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="prose prose-lg max-w-none">
                <p className="mb-4">
                  The real estate industry is undergoing a revolutionary transformation with the integration of cryptocurrency payments and blockchain technology. This shift is not just about adding another payment method; it is about fundamentally changing how property transactions are conducted, recorded, and verified.
                </p>
                {blogSections.map((section) => {
                  const ListTag = section.ordered ? 'ol' : 'ul';

                  return (
                    <section key={section.heading}>
                      <h2 className="text-2xl font-semibold mt-8 mb-4">{section.heading}</h2>
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph} className="mb-4">
                          {paragraph}
                        </p>
                      ))}
                      {section.items ? (
                        <ListTag className={`${section.ordered ? 'list-decimal' : 'list-disc'} pl-6 mb-4`}>
                          {section.items.map((item) => (
                            <li key={item} className="mb-2">
                              {item}
                            </li>
                          ))}
                        </ListTag>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <FiShare2 className="mr-2" />
                  Share this article
                </h3>
                <div className="flex space-x-4">
                  <button className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200">
                    <FaFacebook size={20} />
                  </button>
                  <button className="p-2 rounded-full bg-sky-100 text-sky-500 hover:bg-sky-200">
                    <FaTwitter size={20} />
                  </button>
                  <button className="p-2 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200">
                    <FaLinkedin size={20} />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <FiTag className="mr-2" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-secondary-100 text-secondary-600 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default BlogPost;
