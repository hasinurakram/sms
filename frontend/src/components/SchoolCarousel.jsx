import React from 'react';
import Slider from 'react-slick';
import SchoolCard from './SchoolCard';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const SchoolCarousel = ({ schools }) => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 1000,
    slidesToShow: 3,
    slidesToScroll: 1,
    arrows: true,
    autoplay: true,
    autoplaySpeed: 3000,
    pauseOnHover: true,
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 2 } },
      { breakpoint: 600, settings: { slidesToShow: 1 } }
    ]
  };

  return (
    <div style={{ width: '90%' }}>
      <Slider {...settings}>
        {schools.map(school => (
          <div key={school.id} style={{ padding: '0 10px' }}>
            <SchoolCard school={school} />
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default SchoolCarousel;